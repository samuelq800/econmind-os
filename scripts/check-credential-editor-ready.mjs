// A deployment guard only: it never installs or changes database objects.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function checkCredentialEditorReady(request) {
  const query = readFileSync("scripts/verify-credential-editor-v2-ready.sql", "utf8");
  const rows = await request(query);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.verified !== true) {
    throw new Error("Credential V2 database prerequisites are missing or unverified");
  }
  const handoff = await request("select to_regprocedure('private.credential_handoff_v03_version()') is not null as verified");
  if (!Array.isArray(handoff) || handoff.length !== 1 || handoff[0]?.verified !== true) {
    throw new Error("Credential v0.3 database prerequisites are missing or unverified");
  }
  const approval = await request("select to_regprocedure('private.credential_direct_wording_approval_ready()') is not null as verified");
  if (!Array.isArray(approval) || approval.length !== 1 || approval[0]?.verified !== true) {
    throw new Error("Credential direct wording approval prerequisites are missing or unverified");
  }
  const distinction = await request(`select coalesce(position('Distinction requires the verified achievement and approval record'
    in pg_get_functiondef(to_regprocedure('private.snapshot_credential_editor_data()'))) = 0, false) as verified`);
  if (!Array.isArray(distinction) || distinction.length !== 1 || distinction[0]?.verified !== true) {
    throw new Error("Credential optional Distinction evidence prerequisites are missing or unverified");
  }
}
export async function main() {
  const project = "vimksjrhaxdpnkvgsavz";
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || process.env.SUPABASE_PROJECT_REF !== project) throw new Error("Approved main OS project required");
  await checkCredentialEditorReady(async query => {
    const result = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query/read-only`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000),
    });
    if (!result.ok) throw new Error(`Credential V2 read-only prerequisite HTTP ${result.status}`);
    return result.json();
  });
  console.log("Credential V2 prerequisites verified without database changes");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {console.error(error.message);process.exitCode=1;});
