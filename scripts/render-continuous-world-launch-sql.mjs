import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const directory = resolve(root, "data/economic-calibration");
const slug = process.argv.find((argument) => argument.startsWith("--slug="))?.slice(7) ?? "econmind-continuous-world";
if (!/^[a-z0-9-]{3,100}$/.test(slug)) throw new Error("World slug is invalid.");

const load = async (name) => {
  const raw = await readFile(resolve(directory, name), "utf8");
  return { value: JSON.parse(raw), checksum: createHash("sha256").update(raw).digest("hex") };
};
const [metadata, countries, markets, policies, shocks] = await Promise.all([
  load("package_metadata.json"), load("world_country_calibration.json"), load("market_baselines.json"), load("policy_effect_library.json"), load("shock_library.json"),
]);
const packages = [
  ["world_country_calibration", countries],
  ["market_baselines", markets],
  ["policy_effect_library", policies],
  ["shock_library", shocks],
];
const state = {
  worldId: "pending",
  calibrationVersion: metadata.value.version,
  lastProcessedAt: new Date().toISOString(),
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
const literal = (value) => `$econmind_json$${JSON.stringify(value)}$econmind_json$::jsonb`;
const text = (value) => `'${String(value).replaceAll("'", "''")}'`;
const version = text(metadata.value.version);
const packageRows = packages.map(([key, entry]) => `(${text(key)}, ${version}, 'validated', ${literal(entry.value)}, ${literal({ package_id: metadata.value.package_id, released_at: metadata.value.released_at, source_file: `${key}.json` })}, ${text(entry.checksum)}, timezone('utc', now()))`).join(",\n  ");
const packageKeys = packages.map(([key]) => text(key)).join(", ");
const checksumCases = packages.map(([key, entry]) => `when ${text(key)} then ${text(entry.checksum)}`).join(" ");
const manifest = Object.fromEntries(packages.map(([key, entry]) => [key, { version: metadata.value.version, checksum: entry.checksum }]));

console.log(`-- Generated from the versioned EconMind calibration package. Do not edit this output.\n\nbegin;\n\ninsert into public.calibration_packages (package_key, package_version, status, payload, provenance, checksum, validated_at)\nvalues\n  ${packageRows}\non conflict (package_key, package_version, checksum) do nothing;\n\nupdate public.calibration_packages\nset status = 'superseded'\nwhere package_key in (${packageKeys})\n  and status = 'active'\n  and checksum <> case package_key ${checksumCases} end;\n\nupdate public.calibration_packages\nset status = 'active', activated_at = timezone('utc', now())\nwhere package_key in (${packageKeys})\n  and package_version = ${version}\n  and checksum = case package_key ${checksumCases} end;\n\ndo $econmind_launch$\ndeclare created_world_id uuid;\nbegin\n  if exists(select 1 from public.continuous_worlds where slug = ${text(slug)}) then\n    raise exception 'Continuous world ${slug} already exists; historic state is never overwritten.';\n  end if;\n  insert into public.continuous_worlds (slug, name, description, status, calibration_version, calibration_manifest, current_state, state_version, tick_interval_seconds, next_tick_at)\n  values (${text(slug)}, 'EconMind Continuous World Economy', 'A persistent fictional twelve-country economy with versioned calibration and server-side processing.', 'running', ${version}, ${literal(manifest)}, ${literal(state)}, 0, 3600, timezone('utc', now()))\n  returning id into created_world_id;\n  update public.continuous_worlds\n  set current_state = jsonb_set(current_state, '{worldId}', to_jsonb(created_world_id::text), true)\n  where id = created_world_id;\nend;\n$econmind_launch$;\n\nselect id, slug, status, calibration_version, state_version, next_tick_at\nfrom public.continuous_worlds\nwhere slug = ${text(slug)};\n\ncommit;`);
