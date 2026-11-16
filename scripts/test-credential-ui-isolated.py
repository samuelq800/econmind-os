#!/usr/bin/env python3
"""Build and exercise only credential UI with synthetic identities and data."""
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAYWRIGHT = ROOT / "infra/credential-renderer/node_modules/playwright/index.mjs"

with tempfile.TemporaryDirectory(prefix="em-ui-", dir="/tmp") as directory:
    tmp = Path(directory)
    files = ["components/admin/credential-admin.tsx", "components/admin/credential-signature-select.tsx", "lib/credentials/import.ts", "lib/credentials/signatures.ts", "lib/supabase/credential-research-sources.ts", "app/admin/credentials/page.tsx"]
    for name in files:
        destination = tmp / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
    (tmp / "components/auth").mkdir(parents=True)
    (tmp / "components/auth/auth-provider.ts").write_text('export function useAuth(){return {user:{id:"synthetic"},loading:false,configured:true,openAuth:(_mode:"sign-in")=>{}}}\n')
    (tmp / "lib/supabase/client.ts").write_text('''
import type { SupabaseClient } from "@supabase/supabase-js";
const channel = { on(){ return this }, subscribe(){ return this } };
const fake = {
  async rpc(name:string, params?:unknown) {
    if(name === "create_credential_draft") { (window as unknown as {testDraft:unknown}).testDraft=params; return {data:null,error:null}; }
    if(name === "list_credential_admin_data") return {data:{counts:{issued:0,issued_this_month:0,revoked:0},pending:0,templates:[{id:"00000000-0000-4000-8000-000000000001",category:"CON",subtype:"Test",version:1,active:true}],batches:[],credentials:[]},error:null};
    return {data:[],error:null};
  }, channel(){return channel}, async removeChannel(){}, auth:{ async getSession(){return {data:{session:{access_token:"synthetic"}}}} }
};
export function requireSupabaseBrowserClient(){return fake as unknown as SupabaseClient}
export function throwIfSupabaseError(e:unknown){if(e)throw e}
''')
    (tmp / "app/layout.tsx").write_text('export default function RootLayout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}\n')
    (tmp / "package.json").write_text('{"name":"credential-ui-synthetic-test","private":true,"version":"0.0.0"}\n')
    (tmp / "tsconfig.json").write_text('{"compilerOptions":{"target":"ES2022","lib":["dom","dom.iterable","esnext"],"skipLibCheck":true,"strict":true,"noEmit":true,"esModuleInterop":true,"module":"esnext","moduleResolution":"bundler","jsx":"react-jsx","baseUrl":".","paths":{"@/*":["./*"]}},"include":["**/*.ts","**/*.tsx",".next/types/**/*.ts"],"exclude":["node_modules"]}\n')
    os.symlink(ROOT / "node_modules", tmp / "node_modules")
    env = {**os.environ, "NEXT_TELEMETRY_DISABLED": "1"}
    subprocess.run([str(ROOT / "node_modules/.bin/next"), "build", "--webpack"], cwd=tmp, env=env, check=True)
    server = subprocess.Popen([str(ROOT / "node_modules/.bin/next"), "start", "-p", "45981", "-H", "127.0.0.1"], cwd=tmp, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen("http://127.0.0.1:45981/admin/credentials", timeout=1).close()
                break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("Synthetic UI did not start")
        js = f'''import {{ chromium }} from {str(PLAYWRIGHT.as_uri())!r};
const browser=await chromium.launch({{headless:true}});
try {{
 const page=await browser.newPage();
 await page.goto("http://127.0.0.1:45981/admin/credentials");
 await page.getByRole("heading",{{name:"Create a draft"}}).waitFor();
 await page.getByLabel("Template").selectOption("00000000-0000-4000-8000-000000000001");
 await page.getByLabel("Recipients, one name per line").fill("Synthetic Person");
 await page.getByLabel("Issue date").fill("2026-11-16");
 await page.getByLabel("Signatory").selectOption("yale_chen_v1");
 await page.getByRole("button",{{name:"Save draft"}}).click();
 await page.waitForFunction(() => Boolean(window.testDraft));
 const result=await page.evaluate(() => window.testDraft);
 if(result.p_signature_key!=="yale_chen_v1"||result.p_entries[0].name!=="Synthetic Person") throw new Error("Signature or draft fields were lost");
 await page.locator('input[type="file"]').setInputFiles({str((ROOT / "tests/fixtures/credential-import.xlsx").as_posix())!r});
 await page.getByText("Imported recipients · 1").waitFor();
 console.log("PASS: synthetic browser draft, signer selection and XLSX import");
}} finally {{await browser.close()}}'''
        subprocess.run(["node", "--input-type=module", "-e", js], cwd=tmp, env=env, check=True)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
