// Read-only release prerequisite; never installs migrations or discloses assets.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function checkCredentialBackend(request) {
  const query = readFileSync("scripts/verify-credential-ready.sql", "utf8");
  const evidence = await request(query);
  if (!Array.isArray(evidence) || evidence.length !== 1 || evidence[0]?.verified !== true) {
    throw new Error("Credential backend verification failed");
  }
  return true;
}

export async function main() {
  const project = "vimksjrhaxdpnkvgsavz";
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || process.env.SUPABASE_PROJECT_REF !== project) throw new Error("Approved main OS project required");
  await checkCredentialBackend(async (query) => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query/read-only`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Read-only credential prerequisite HTTP ${response.status}`);
    return response.json();
  });
  console.log("Credential backend verified (read-only); no database changes");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
