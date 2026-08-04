import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const calibrationDirectory = resolve(root, "data/economic-calibration");
const args = new Set(process.argv.slice(2));
const requestedSlug = process.argv.find((argument) => argument.startsWith("--slug="))?.slice("--slug=".length) ?? "econmind-continuous-world";
const tickSeconds = Number(process.argv.find((argument) => argument.startsWith("--tick-seconds="))?.slice("--tick-seconds=".length) ?? 7200);

if (!args.has("--confirm-launch")) {
  console.error("Refusing to create a live world without --confirm-launch.");
  console.error("Example: pnpm world:launch -- --confirm-launch --start");
  process.exit(1);
}
if (!/^[a-z0-9-]{3,100}$/.test(requestedSlug) || !Number.isInteger(tickSeconds) || tickSeconds < 300 || tickSeconds > 86400) {
  console.error("The slug or tick interval is invalid.");
  process.exit(1);
}

execFileSync(process.execPath, [resolve(root, "scripts/validate-economic-calibration.mjs"), "--strict"], { stdio: "inherit" });

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required in this local server-only command.");
  process.exit(1);
}

const load = async (file) => {
  const raw = await readFile(resolve(calibrationDirectory, file), "utf8");
  return { raw, value: JSON.parse(raw), checksum: createHash("sha256").update(raw).digest("hex") };
};
const [metadata, countries, markets, policies, shocks] = await Promise.all([
  load("package_metadata.json"),
  load("world_country_calibration.json"),
  load("market_baselines.json"),
  load("policy_effect_library.json"),
  load("shock_library.json"),
]);
const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
const inputs = [
  ["world_country_calibration", countries],
  ["market_baselines", markets],
  ["policy_effect_library", policies],
  ["shock_library", shocks],
];
const packageRows = [];
for (const [packageKey, input] of inputs) {
  const { data: existing, error: existingError } = await supabase.from("calibration_packages")
    .select("id,package_key,package_version,checksum,status")
    .eq("package_key", packageKey)
    .eq("package_version", metadata.value.version)
    .eq("checksum", input.checksum)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) { packageRows.push(existing); continue; }
  const { data, error } = await supabase.from("calibration_packages").insert({
    package_key: packageKey,
    package_version: metadata.value.version,
    status: "validated",
    payload: input.value,
    provenance: { package_id: metadata.value.package_id, released_at: metadata.value.released_at, source_file: `${packageKey}.json` },
    checksum: input.checksum,
    validated_at: new Date().toISOString(),
  }).select("id,package_key,package_version,checksum,status").single();
  if (error || !data) throw new Error(error?.message ?? `Could not save ${packageKey}.`);
  packageRows.push(data);
}

for (const row of packageRows) {
  const { error: retireError } = await supabase.from("calibration_packages").update({ status: "superseded" })
    .eq("package_key", row.package_key).eq("status", "active").neq("id", row.id);
  if (retireError) throw new Error(retireError.message);
  const { error: activateError } = await supabase.from("calibration_packages").update({ status: "active", activated_at: new Date().toISOString() }).eq("id", row.id);
  if (activateError) throw new Error(activateError.message);
}

const { data: existingWorld, error: existingWorldError } = await supabase.from("continuous_worlds").select("id").eq("slug", requestedSlug).maybeSingle();
if (existingWorldError) throw new Error(existingWorldError.message);
if (existingWorld) throw new Error(`A world with slug ${requestedSlug} already exists. Its historical state will not be overwritten.`);

const launchedAt = new Date().toISOString();
const initialState = {
  worldId: "pending",
  calibrationVersion: metadata.value.version,
  lastProcessedAt: launchedAt,
  stateVersion: 0,
  countries: countries.value.countries.map((country) => ({ id: country.id, baseline: country.values, outcomes: {} })),
  markets: markets.value.markets.map((market) => ({
    id: market.id,
    price: market.price.initial,
    priceFloor: market.price.floor,
    priceCeiling: market.price.ceiling,
    supply: market.flow.supply,
    demand: market.flow.demand,
    inventoryDays: market.flow.inventory_days,
    stockFloorDays: market.flow.stock_floor_days,
    kappa: (markets.value.clearing.default_kappa_range[0] + markets.value.clearing.default_kappa_range[1]) / 2,
  })),
};
const { data: world, error: worldError } = await supabase.from("continuous_worlds").insert({
  slug: requestedSlug,
  name: "EconMind Continuous World Economy",
  description: "A persistent fictional twelve-country economy with versioned calibration and server-side processing.",
  status: args.has("--start") ? "running" : "draft",
  calibration_version: metadata.value.version,
  calibration_manifest: Object.fromEntries(packageRows.map((row) => [row.package_key, { id: row.id, version: row.package_version, checksum: row.checksum }])),
  current_state: initialState,
  state_version: 0,
  tick_interval_seconds: tickSeconds,
  next_tick_at: args.has("--start") ? launchedAt : null,
}).select("id,slug,status").single();
if (worldError || !world) throw new Error(worldError?.message ?? "Could not create the continuous world.");
const { error: stateError } = await supabase.from("continuous_worlds").update({ current_state: { ...initialState, worldId: world.id } }).eq("id", world.id);
if (stateError) throw new Error(stateError.message);
console.log(`Created ${world.slug} (${world.id}) in ${world.status} mode with calibration ${metadata.value.version}.`);
