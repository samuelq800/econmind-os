#!/usr/bin/env python3
"""Build and exercise only credential UI with synthetic identities and data."""
import os
import base64
import json
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
    files = ["components/admin/credential-admin.tsx", "components/admin/credential-signature-select.tsx", "lib/credentials/import.ts", "lib/credentials/signatures.ts", "lib/credentials/browser-print.ts", "lib/supabase/credential-research-sources.ts", "app/admin/credentials/page.tsx"]
    for name in files:
        destination = tmp / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
    (tmp / "components/auth").mkdir(parents=True)
    (tmp / "components/auth/auth-provider.ts").write_text('export function useAuth(){return {user:{id:"synthetic"},loading:false,configured:true,openAuth:(_mode:"sign-in")=>{}}}\n')
    template = Path('/Users/samuel/Documents/Codex/2026-11-16/referenced-chatgpt-conversation-this-is-an/outputs/EconMind_Certificate_Integration_Handoff/EconMind_League_Yale_Founding_Leadership_Certificate.html').read_text()
    signature = base64.b64encode(Path('/Users/samuel/.codex/private/econmind-credentials/signatures/yale-chen.png').read_bytes()).decode()
    (tmp / 'lib/supabase/test-assets.json').write_text(json.dumps({'template_html': template, 'yale_signature': signature}))
    (tmp / "lib/supabase/client.ts").write_text('''
import type { SupabaseClient } from "@supabase/supabase-js";
import assets from "./test-assets.json";
const channel = { on(){ return this }, subscribe(){ return this } };
const entry={name:"Synthetic Preview",role:"Researcher",department:"Research",project:"Example",contribution:"Sample contribution.",service_period:"2026"};
const batch={id:"00000000-0000-4000-8000-000000000002",template_id:"00000000-0000-4000-8000-000000000001",status:"draft",issue_date:"2026-11-16",issuing_authority:"EconMind Founder Team",signature_key:"yale_chen_v1",preview_verified_at:null,entries:[entry],category:"CON",subtype:"Test",template:{title:"CONTRIBUTION"},credentials:[]};
const fake = {
  async rpc(name:string, params?:unknown) {
    if(name === "create_credential_draft") { (window as unknown as {testDraft:unknown}).testDraft=params; return {data:null,error:null}; }
    if(name === "get_credential_visual_assets") { const state=window as unknown as {assetLoads?:number}; state.assetLoads=(state.assetLoads||0)+1; return {data:assets,error:null}; }
    if(name === "list_credential_organization_page") return {data:[{id:"org-1",name:"Synthetic Leader",title:"Director",organizational_group:"technology-team",public_visible:true}],error:null};
    if(name === "list_credential_research_sources") return {data:[{paper_id:"00000000-0000-4000-8000-000000000004",author_display_name:"Synthetic Author",title:"Synthetic Research",status:"published"}],error:null};
    if(name === "get_credential_render_data") {
      const request=params as {p_credential_id?:string};
      if(request.p_credential_id) return {data:{...batch,status:"issued",credentials:[{id:request.p_credential_id,status:"issued",certificate_number:"EML-CON-2026-000001",recipient_snapshot:entry}]},error:null};
      const nameOverride=(window as unknown as {testLong?:string}).testLong;
      return {data:{...batch,entries:[{...entry,name:nameOverride || entry.name}]},error:null};
    }
    if(name === "list_credential_admin_data") return {data:{counts:{issued:1,issued_this_month:1,revoked:0},pending:1,templates:[{id:"00000000-0000-4000-8000-000000000001",category:"CON",subtype:"Test",version:1,active:true}],batches:[batch],credentials:[{id:"00000000-0000-4000-8000-000000000003",batch_id:batch.id,template_id:batch.template_id,certificate_number:"EML-CON-2026-000001",recipient_name:entry.name,status:"issued",signature_key:batch.signature_key,created_at:"2026-11-16",recipient_snapshot:entry}]},error:null};
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
import {{ execFileSync }} from "node:child_process";
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
 await page.getByRole("button",{{name:"Add all organization entries"}}).click();
 await page.getByRole("button",{{name:"Add all research author entries"}}).click();
 await page.getByText("Imported recipients · 3").waitFor();
 if(await page.getByLabel("role",{{exact:true}}).nth(1).inputValue()!=="Director" || await page.getByLabel("project",{{exact:true}}).nth(2).inputValue()!=="Synthetic Research") throw new Error("Source fields were not preserved");
 await page.getByRole("button",{{name:"Preview",exact:true}}).click();
 await page.frameLocator('iframe[title="Certificate preview"]').locator('.award-name').getByText("Synthetic Preview").waitFor();
 await page.getByRole("button",{{name:"Mark reviewed"}}).waitFor({{state:"visible"}});
 await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Mark reviewed' && !b.disabled), {{timeout: 10000}}).catch(async () => {{ const data=await page.frameLocator('iframe[title="Certificate preview"]').locator('.award-name').evaluate(e => ({{scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,rect:e.getBoundingClientRect().toJSON(), page:e.ownerDocument.querySelector('.certificate').getBoundingClientRect().toJSON()}})); throw new Error("Approved preview failed: " + JSON.stringify(data) + await page.locator('[role=alert]').allTextContents()) }});
 await page.frameLocator('iframe[title="Certificate preview"]').locator('.certificate').screenshot({{path:'/Users/samuel/.codex/private/econmind-credentials/browser-print-test.png'}});
 await page.evaluate(() => {{window.testLong='M'.repeat(200)}});
 await page.getByRole("button",{{name:"Preview",exact:true}}).click();
 await page.getByRole("alert").filter({{hasText:"Text exceeds the approved certificate layout"}}).waitFor();
 await page.evaluate(() => {{window.testLong='<img src=x onerror=alert(1)>'}});
 await page.getByRole("button",{{name:"Preview",exact:true}}).click();
 await page.frameLocator('iframe[title="Certificate preview"]').locator('.award-name').getByText('<img src=x onerror=alert(1)>').waitFor();
 if(await page.frameLocator('iframe[title="Certificate preview"]').locator('script, .award-name img').count()) throw new Error("Untrusted text or template script became active markup");
 await page.getByRole("button",{{name:"View / Print"}}).click();
 await page.frameLocator('iframe[title="Certificate preview"]').locator('.award-name').getByText("Synthetic Preview").waitFor();
 await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Print / Save PDF' && !b.disabled));
 const frame=page.frameLocator('iframe[title="Certificate preview"]');
 await frame.locator('body').evaluate(e => {{e.ownerDocument.defaultView.print=()=>{{e.dataset.printCalled='yes'}}}});
 await page.getByRole("button",{{name:"Print / Save PDF"}}).click();
 await frame.locator('body[data-print-called="yes"]').waitFor();
 if(await page.evaluate(() => window.assetLoads)!==1) throw new Error("Private visual assets were fetched repeatedly");
 const docHtml=await page.locator('iframe[title="Certificate preview"]').getAttribute('srcdoc');
 const printPage=await browser.newPage({{viewport:{{width:1123,height:794}}}});
 await printPage.setContent(docHtml);
 await printPage.emulateMedia({{media:"print"}});
 await printPage.pdf({{path:"synthetic-certificate.pdf",format:"A4",landscape:true,printBackground:true,displayHeaderFooter:false,preferCSSPageSize:true}});
 const pdfInfo=execFileSync("pdfinfo",["synthetic-certificate.pdf"],{{encoding:"utf8"}});
 if(!/Pages:\\s+1\\b/.test(pdfInfo)||!/Page size:\\s+84[01](\\.\\d+)? x 59[45](\\.\\d+)? pts/.test(pdfInfo)) throw new Error("Browser print did not produce one landscape A4 page");
 await printPage.close();
 console.log("PASS: synthetic draft, signer selection, XLSX, overflow detection and browser print");
}} finally {{await browser.close()}}'''
        subprocess.run(["node", "--input-type=module", "-e", js], cwd=tmp, env=env, check=True)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
