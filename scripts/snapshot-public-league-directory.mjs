import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../lib/league/public-directory-snapshot.json", import.meta.url));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Public Supabase URL and anon key are required to refresh the League snapshot.");
}

const fields = [
  "school_id", "school_name", "club_name", "city", "description", "logo_url",
  "member_count", "team_count", "current_season_points", "official_challenge_count",
  "official_wins", "achievements", "location_status", "location_source",
  "location_key", "location_city", "location_area_key", "location_area_label",
  "location_administrative_area", "location_latitude", "location_longitude",
];
const numericFields = new Set([
  "member_count", "team_count", "current_season_points", "official_challenge_count",
  "official_wins", "location_latitude", "location_longitude",
]);

let schools;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_league_directory_v2`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Public League RPC returned HTTP ${response.status}.`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Public League RPC returned an empty or invalid directory.");
    }
    const ids = new Set();
    schools = rows.map((row) => {
      if (!row || typeof row.school_id !== "string" || typeof row.school_name !== "string" || !row.school_name.trim() || ids.has(row.school_id)) {
        throw new Error("Public League RPC returned an invalid or duplicate school.");
      }
      ids.add(row.school_id);
      return Object.fromEntries(fields.map((field) => {
        const value = row[field] ?? null;
        if (numericFields.has(field)) return [field, value === null ? null : Number(value)];
        if (field === "achievements") return [field, Array.isArray(value) ? value.filter((item) => typeof item === "string") : []];
        return [field, value];
      }));
    });
    break;
  } catch (error) {
    if (attempt === 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
}

await mkdir(fileURLToPath(new URL("../lib/league/", import.meta.url)), { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), schools }, null, 2)}\n`);
console.log(`Saved ${schools.length} approved schools to the public League build snapshot.`);
