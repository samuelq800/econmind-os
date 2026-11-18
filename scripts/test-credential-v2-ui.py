#!/usr/bin/env python3
"""Exercise V2 with synthetic accounts in a disposable local browser.

Uses the approved private certificate from local protected storage; it is never
written to the repository or logged. No production records are read or changed.
"""
import base64
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = Path(os.environ.get('CREDENTIAL_PRIVATE_TEMPLATE', '/Users/samuel/Documents/Codex/2026-11-16/referenced-chatgpt-conversation-this-is-an/outputs/EconMind_Certificate_Integration_Handoff/EconMind_League_Yale_Founding_Leadership_Certificate.html'))
SIGNATURE = Path(os.environ.get('CREDENTIAL_PRIVATE_YALE_SIGNATURE', '/Users/samuel/.codex/private/econmind-credentials/signatures/yale-chen.png'))
PLAYWRIGHT = ROOT / 'infra/credential-renderer/node_modules/playwright/index.mjs'
if not TEMPLATE.is_file() or not SIGNATURE.is_file():
    raise SystemExit('Approved private test assets are required; set CREDENTIAL_PRIVATE_TEMPLATE and CREDENTIAL_PRIVATE_YALE_SIGNATURE.')
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
with tempfile.TemporaryDirectory(prefix='em-v2-ui-', dir='/tmp') as folder:
    tmp = Path(folder)
    files = ['components/admin/credential-admin.tsx','components/admin/credential-canvas.tsx','components/admin/credential-visual-editor.tsx',
             'components/admin/credential-wording-library.tsx','components/admin/credential-signature-select.tsx',
             'lib/credentials/import.ts','lib/credentials/wording.ts','lib/credentials/date.ts','lib/credentials/signatures.ts','lib/credentials/browser-print.ts',
             'lib/supabase/credential-research-sources.ts','lib/credentials/research-source.ts','lib/team/team-data.ts','app/admin/credentials/page.tsx','app/globals.css','postcss.config.mjs']
    for name in files:
        dest = tmp / name; dest.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(ROOT / name, dest)
    (tmp / 'components/auth').mkdir(parents=True)
    (tmp / 'components/auth/auth-provider.ts').write_text('export function useAuth(){return {user:{id:"synthetic-admin"},loading:false,configured:true,openAuth:(_mode:"sign-in")=>{}}}\n')
    (tmp / 'lib/supabase/test-assets.json').write_text(json.dumps({'template_html': TEMPLATE.read_text(), 'yale_signature': base64.b64encode(SIGNATURE.read_bytes()).decode()}))
    (tmp / 'lib/supabase/client.ts').write_text('''
import type { SupabaseClient } from "@supabase/supabase-js";
import assets from "./test-assets.json";
type Any = Record<string,any>;
const channel={on(){return this},subscribe(){return this}};
const issuedEntry={name:"Synthetic Issued",role:"Researcher",department:"Research",project:"Synthetic",contribution:"",service_period:""};
const issued={id:"issued-1",batch_id:"issued-batch",template_id:"legacy",certificate_number:"EML-CON-2026-000001",recipient_name:issuedEntry.name,status:"issued",signature_key:"samuel_qian_v1",created_at:"2026-01-01",recipient_snapshot:issuedEntry,template_snapshot:{text_content:{title:"Certificate of Contribution",certification_statement:"Synthetic issued wording."}}};
const issuedBatch={id:"issued-batch",template_id:"legacy",status:"issued",issue_date:"2026-01-01",issuing_authority:"EconMind Founder Team",signature_key:"samuel_qian_v1",preview_verified_at:"2026-01-01",entries:[issuedEntry],category:"CON",subtype:"Contribution",template:{title:"CONTRIBUTION"},credentials:[issued]};
const state:Any={batches:[issuedBatch],editors:{},last:null,versions:[],credentials:[issued],assetLoads:0};
if(typeof window!=="undefined"){(window as unknown as {testState:Any}).testState=state;(window as unknown as {testYale:string}).testYale=assets.yale_signature;}
const fake={async rpc(name:string, p:Any={}){
 if(name==="list_credential_admin_data")return {data:{counts:{issued:1,issued_this_month:0,revoked:0},pending:state.batches.filter((b:Any)=>b.status==='draft').length,templates:[],batches:state.batches,credentials:state.credentials},error:null};
 if(name==="get_credential_visual_assets") {state.assetLoads++;return {data:assets,error:null};}
 if(name==="get_credential_handoff_catalog")return {data:{imported:false,presets:[],archive:[]},error:null};
 if(name==="list_credential_wording_versions")return {data:structuredClone(state.versions),error:null};
 if(name==="list_credential_organization_identities")return {data:[{id:"org-1",name:"Synthetic Leader",title:"Director",organizational_group:"technology-team"}],error:null};
 const papers=[{paper_id:"paper-1",uploader_user_id:"00000000-0000-4000-8000-000000000005",owner_name_matches:false,author_display_name:"Synthetic Author",title:"Synthetic Research",status:"published"},{paper_id:"paper-2",uploader_user_id:"00000000-0000-4000-8000-000000000006",owner_name_matches:true,author_display_name:"Matched Author",title:"Linked Research",status:"published"}].map(row=>({...row,updated_at:"2026-01-01T00:00:00Z"}));
 if(name==="list_credential_research_sources")return {data:papers,error:null};
 if(name==="get_credential_research_source")return {data:papers.find(row=>row.paper_id===p.p_paper_id),error:null};
 if(name==="save_credential_editor_draft"){
  const id=p.p_batch_id||"batch-"+(state.batches.length+1); const rev=(state.editors[id]?.revision||0)+1;
  const batch={id,template_id:"base",status:"draft",issue_date:p.p_issue_date,issuing_authority:p.p_issuing_authority,signature_key:p.p_signature_key,preview_verified_at:null,entries:p.p_entries,category:p.p_category,subtype:p.p_subtype,template:{},credentials:[]};
  state.editors[id]={wordings:p.p_wordings,source_refs:p.p_source_refs,wording_refs:p.p_wording_refs,revision:rev};state.batches=state.batches.filter((b:Any)=>b.id!==id).concat(batch);state.last=p;
  return {data:{id,revision:rev},error:null};
 }
 if(name==="get_credential_editor_render_data"||name==="get_credential_render_data") {const b=state.batches.find((item:Any)=>item.id===p.p_batch_id);return {data:b?{...b,editor:state.editors[b.id]}:null,error:b?null:{message:"Not found"}};}
 if(name==="create_credential_wording_version") {state.versions.push({id:"wording-"+(state.versions.length+1),category:p.p_category,subtype:p.p_subtype,template_name:p.p_template_name,version:1,status:"draft",text_content:p.p_text_content});return {data:null,error:null};}
 if(name==="set_credential_wording_status") {const v=state.versions.find((item:Any)=>item.id===p.p_id);v.status=p.p_status;return {data:null,error:null};}
 if(name==="review_credential_editor_draft") {const b=state.batches.find((item:Any)=>item.id===p.p_batch_id);if(!b || state.editors[b.id]?.revision!==p.p_expected_revision)return {data:null,error:{message:"Stale review"}};b.status="reviewed";return {data:null,error:null};}
 if(name==="confirm_credential_print_review") {const b=state.batches.find((item:Any)=>item.id===p.p_batch_id);b.preview_verified_at="confirmed";return {data:null,error:null};}
 if(name==="issue_credential_batch") {const b=state.batches.find((item:Any)=>item.id===p.p_batch_id);b.status="issued";return {data:[],error:null};}
 return {data:[],error:null};
},channel(){return channel},async removeChannel(){},auth:{async getSession(){return {data:{session:{access_token:"synthetic"}}}}}};
export function requireSupabaseBrowserClient(){return fake as unknown as SupabaseClient}
export function throwIfSupabaseError(e:unknown){if(e)throw e}
''')
    (tmp / 'app/layout.tsx').write_text('import "./globals.css"; export default function RootLayout({children}:{children:React.ReactNode}){return <html className="dark"><body>{children}</body></html>}\n')
    (tmp / 'app/baseline').mkdir()
    (tmp / 'app/baseline/page.tsx').write_text('''
"use client";
import {useEffect,useState} from "react";
import assets from "@/lib/supabase/test-assets.json";
import {certificatePrintHtml} from "@/lib/credentials/browser-print";
export default function Baseline(){
 const [html,setHtml]=useState("");
 useEffect(()=>{void certificatePrintHtml(assets,{issue_date:"2027-02-28",issuing_authority:"EconMind Founder Team",signature_key:"samuel_qian_v1",category:"LEA",subtype:"Initial Founder",template:{title:"EDITED TITLE",certification_statement:"Edited directly in the original certificate."}},{name:"Edited In Certificate",role:"Synthetic Lead",department:"",project:"",contribution:"",service_period:""},null).then(setHtml)},[]);
 return html?<iframe title="V1 print baseline" sandbox="allow-same-origin" srcDoc={html} style={{width:1180,height:1100}}/>:null;
}
''')
    (tmp / 'package.json').write_text('{"name":"credential-v2-isolated-test","private":true,"version":"0.0.0"}\n')
    (tmp / 'tsconfig.json').write_text('{"compilerOptions":{"target":"ES2022","lib":["dom","dom.iterable","esnext"],"skipLibCheck":true,"strict":true,"noEmit":true,"esModuleInterop":true,"module":"esnext","moduleResolution":"bundler","jsx":"react-jsx","baseUrl":".","paths":{"@/*":["./*"]}},"include":["**/*.ts","**/*.tsx",".next/types/**/*.ts"],"exclude":["node_modules"]}\n')
    os.symlink(ROOT / 'node_modules', tmp / 'node_modules')
    env = {**os.environ, 'NEXT_TELEMETRY_DISABLED':'1'}
    server_log = (tmp / 'server.log').open('w+')
    build = subprocess.run([str(ROOT / 'node_modules/.bin/next'),'build','--webpack'],cwd=tmp,env=env,stdout=server_log,stderr=subprocess.STDOUT,timeout=120)
    if build.returncode:
        server_log.flush(); server_log.seek(0)
        raise RuntimeError('Synthetic test build failed: ' + server_log.read()[-6000:])
    server = subprocess.Popen([str(ROOT / 'node_modules/.bin/next'),'start','-p',str(port),'-H','127.0.0.1'], cwd=tmp, env=env, stdout=server_log, stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try: urllib.request.urlopen(f'http://127.0.0.1:{port}/admin/credentials',timeout=1).close(); break
            except Exception: time.sleep(.3)
        else:
            server_log.flush(); server_log.seek(0)
            raise RuntimeError('Synthetic test server did not start: ' + server_log.read()[-3000:])
        script = r'''
import { chromium } from PLAYWRIGHT_PATH;
import { execFileSync } from 'node:child_process';
const browser=await chromium.launch({headless:true});
let page;
try {
 page=await browser.newPage({viewport:{width:1800,height:1200}});
 page.on('pageerror',error=>console.error('PAGE_ERROR',error.message));
 await page.goto(BASE_URL,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Certificate Editor',exact:true}).click();
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).waitFor();
 let f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.getByRole('textbox',{name:'Certification statement'}).fill('Started directly in the certificate.');
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).click();
 if(await page.getByRole('textbox',{name:'Certification statement',exact:true}).inputValue()!=='Started directly in the certificate.')throw new Error('Empty wording could not be edited inline');
 await page.getByRole('textbox',{name:'Recipient name',exact:true}).fill('Synthetic Recipient');
 await page.getByRole('textbox',{name:'Certificate title',exact:true}).fill('CERTIFICATE OF LEADERSHIP');
 await page.getByRole('textbox',{name:'Certification statement',exact:true}).fill('For the verified contribution recorded by the administrator.');
 await page.getByRole('textbox',{name:'Role / position',exact:true}).fill('Synthetic Lead');
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.locator('.award-name').getByText('Synthetic Recipient').waitFor();
 await f.getByRole('textbox',{name:'Recipient name'}).fill('Edited In Certificate');
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).click();
 await page.waitForFunction(()=>document.querySelector('input') && [...document.querySelectorAll('input')].some(x=>x.value==='Edited In Certificate'));
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.locator('.award-name').getByText('Edited In Certificate').waitFor();
 const nameBox=f.getByRole('textbox',{name:'Recipient name'});
 await nameBox.click();
 await nameBox.evaluate(el=>{const d=el.ownerDocument,s=d.getSelection(),r=d.createRange();r.selectNodeContents(el);s.removeAllRanges();s.addRange(r);const dt=new DataTransfer();dt.setData('text/plain','Pasted Recipient');dt.setData('text/html','<b style="font-size:99px">Pasted Recipient</b>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).click();
 if(await page.getByRole('textbox',{name:'Recipient name',exact:true}).inputValue()!=='Pasted Recipient')throw new Error('Plain text paste did not synchronize');
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 if(await f.locator('.award-name b, .award-name [style*="font-size"]').count())throw new Error('Pasted formatting changed the certificate');
 await page.getByRole('textbox',{name:'Recipient name',exact:true}).fill('Edited In Certificate');
 await f.locator('.award-name').getByText('Edited In Certificate').waitFor();
 await f.getByRole('textbox',{name:'Certification statement'}).fill('Edited directly in the original certificate.');
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).click();
 if(await page.getByRole('textbox',{name:'Certification statement',exact:true}).inputValue()!=='Edited directly in the original certificate.')throw new Error('Statement did not synchronize');
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.getByRole('textbox',{name:'Certificate title'}).fill('EDITED TITLE');
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).click();
 if(await page.getByRole('textbox',{name:'Certificate title',exact:true}).inputValue()!=='EDITED TITLE')throw new Error('Title did not synchronize');
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.locator('.title-main').getByText('EDITED TITLE').waitFor();
 await f.getByRole('textbox',{name:'Issue date'}).fill('31 February 2027');
 await page.getByRole('heading',{name:'Live Certificate Canvas'}).click();
 await page.getByText('Issue date is invalid. Correct the date before saving.').waitFor();
 await page.getByLabel('Issue date',{exact:true}).fill('2027-02-28');
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.locator('.footer-cell').first().getByText('28 February 2027').waitFor();
 if(SCREENSHOT_PATH) await page.screenshot({path:SCREENSHOT_PATH});
 await page.waitForFunction(()=>{const frame=document.querySelector('iframe[title="Live certificate canvas"]');return frame?.contentDocument?.activeElement===frame?.contentDocument?.body});
 await page.waitForTimeout(250);
 await page.locator('iframe[title="Live certificate canvas"]').evaluate(el=>{el.style.height='1100px';el.contentWindow.scrollTo(0,0)});
 await f.locator('.certificate').evaluate(async el=>{await el.ownerDocument.fonts.ready;await Promise.all([...el.ownerDocument.images].map(img=>img.decode()));});
 const baselinePage=await browser.newPage({viewport:{width:1800,height:1200}});
 await baselinePage.goto(BASELINE_URL,{waitUntil:'domcontentloaded'});
 const original=baselinePage.frameLocator('iframe[title="V1 print baseline"]');
 await original.locator('.award-name').getByText('Edited In Certificate').waitFor();
 const normalized=el=>{const copy=el.cloneNode(true);for(const span of [...copy.querySelectorAll('.award-copy > span[contenteditable]')])span.replaceWith(...span.childNodes);for(const node of copy.querySelectorAll('[contenteditable]')){node.removeAttribute('contenteditable');node.removeAttribute('role');node.removeAttribute('aria-label');node.removeAttribute('tabindex');node.style.removeProperty('cursor');if(!node.getAttribute('style'))node.removeAttribute('style');}copy.normalize();return {markup:copy.outerHTML,css:[...el.ownerDocument.querySelectorAll('style')].map(style=>style.textContent).filter(text=>!text.includes('[contenteditable="plaintext-only"]:focus'))}};
 const [editorSource,baselineSource]=await Promise.all([f.locator('.certificate').evaluate(normalized),original.locator('.certificate').evaluate(normalized)]);
 if(JSON.stringify(editorSource)!==JSON.stringify(baselineSource))throw new Error('Editor certificate structure, assets or CSS differ from the V1 print baseline');
 await baselinePage.close();
 const filledState=await f.locator('.certificate').evaluate(el=>{const name=el.querySelector('.award-name'),range=el.ownerDocument.createRange();range.selectNodeContents(name);return {active:el.ownerDocument.activeElement?.outerHTML.slice(0,100),title:el.querySelector('.title-main')?.textContent,copy:el.querySelector('.award-copy')?.textContent,name:range.getBoundingClientRect().toJSON(),selection:el.ownerDocument.getSelection()?.toString()}});
 const filled=await f.locator('.certificate').screenshot();
 await page.getByRole('button',{name:'Final Review'}).click();
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.locator('.award-name').getByText('Edited In Certificate').waitFor();
 await page.locator('iframe[title="Live certificate canvas"]').evaluate(el=>{el.style.height='1100px';el.contentWindow.scrollTo(0,0)});
 await f.locator('.certificate').evaluate(async el=>{await el.ownerDocument.fonts.ready;await Promise.all([...el.ownerDocument.images].map(img=>img.decode()));});
 const review=await f.locator('.certificate').screenshot();
 if(!filled.equals(review)){
  const stats=await page.evaluate(async ([a,b])=>{const decode=src=>new Promise((ok,bad)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=bad;image.src='data:image/png;base64,'+src});const [ia,ib]=await Promise.all([decode(a),decode(b)]);const c=document.createElement('canvas');c.width=ia.width;c.height=ia.height;const g=c.getContext('2d');g.drawImage(ia,0,0);const x=g.getImageData(0,0,c.width,c.height).data;g.clearRect(0,0,c.width,c.height);g.drawImage(ib,0,0);const y=g.getImageData(0,0,c.width,c.height).data;let count=0,minx=c.width,miny=c.height,maxx=0,maxy=0;for(let i=0;i<x.length;i+=4)if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2]||x[i+3]!==y[i+3]){const n=i/4,xx=n%c.width,yy=Math.floor(n/c.width);count++;minx=Math.min(minx,xx);maxx=Math.max(maxx,xx);miny=Math.min(miny,yy);maxy=Math.max(maxy,yy)}return {count,minx,miny,maxx,maxy,width:c.width,height:c.height}},[filled.toString('base64'),review.toString('base64')]);
  const reviewState=await f.locator('.certificate').evaluate(el=>{const name=el.querySelector('.award-name'),range=el.ownerDocument.createRange();range.selectNodeContents(name);return {active:el.ownerDocument.activeElement?.outerHTML.slice(0,100),title:el.querySelector('.title-main')?.textContent,copy:el.querySelector('.award-copy')?.textContent,name:range.getBoundingClientRect().toJSON(),selection:el.ownerDocument.getSelection()?.toString()}});
  console.error('VISUAL_DIFF',stats,filledState,reviewState);throw new Error('Editable preview differs visually from print-based final review');
 }
 if(await f.getByRole('textbox',{name:'Recipient name'}).count())throw new Error('Final review is editable');
 await page.getByRole('button',{name:'Blank Template'}).click();
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await page.waitForTimeout(500);
 if((await f.locator('.award-name').textContent())?.trim())throw new Error('Blank template retained recipient text');
 await page.getByRole('button',{name:'Filled Preview'}).click();
 await page.getByRole('textbox',{name:'Recipient name',exact:true}).fill('W'.repeat(200));
 await page.getByText('Text exceeds the approved certificate layout.',{exact:false}).waitFor();
 await page.getByRole('textbox',{name:'Recipient name',exact:true}).fill('Edited In Certificate');
 await page.getByRole('textbox',{name:'Role / position',exact:true}).fill('A very long role '.repeat(150));
 await page.getByText('Text exceeds the approved certificate layout.',{exact:false}).waitFor();
 await page.getByRole('textbox',{name:'Role / position',exact:true}).fill('Synthetic Lead');
 await page.getByRole('textbox',{name:'Certification statement',exact:true}).fill('A long statement with special characters & < >.\n'.repeat(70));
 await page.getByText('Text exceeds the approved certificate layout.',{exact:false}).waitFor();
 await page.getByRole('textbox',{name:'Certification statement',exact:true}).fill('Edited directly in the original certificate.');
 await page.getByRole('textbox',{name:'Recipient name',exact:true}).fill('<img src=x onerror=alert(1)>');
 f=page.frameLocator('iframe[title="Live certificate canvas"]');
 await f.locator('.award-name').getByText('<img src=x onerror=alert(1)>').waitFor();
 if(await f.locator('script, .award-name img').count())throw new Error('Untrusted recipient text became markup');
 await page.getByRole('textbox',{name:'Recipient name',exact:true}).fill('Edited In Certificate');
 await page.getByLabel('Signatory').selectOption('yale_chen_v1');
 await page.waitForFunction(()=>{const doc=document.querySelector('iframe[title="Live certificate canvas"]')?.contentDocument;return doc?.querySelector('.signature-image')?.getAttribute('src')==='data:image/png;base64,'+window.testYale});
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await page.getByText('Draft saved. No certificate number has been allocated.').waitFor();
 if((await page.evaluate(()=>window.testState.last)).p_signature_key!=='yale_chen_v1')throw new Error('Selected signature was lost');
 await page.getByRole('button',{name:'Save as Draft Wording'}).click();
 await page.getByLabel('Template name').fill('Draft Test');
 await page.getByRole('button',{name:'Save draft version'}).click();
 await page.getByText('Draft wording saved. It is not approved.').waitFor();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Approve',exact:true}).click();
 await page.getByRole('button',{name:'Certificate Editor',exact:true}).click();
 if(await page.getByRole('textbox',{name:'Recipient name',exact:true}).inputValue()!=='Edited In Certificate')throw new Error('Editor state lost when opening wording library');
 await page.getByLabel('Wording template').selectOption('wording-1');
 await page.getByRole('textbox',{name:'Certification statement',exact:true}).fill('A certificate-only edit.');
 await page.getByRole('button',{name:'Reset to Template'}).click();
 if(await page.getByRole('textbox',{name:'Certification statement',exact:true}).inputValue()!=='Edited directly in the original certificate.')throw new Error('Template reset failed');
 await page.getByRole('textbox',{name:'Certification statement',exact:true}).fill('A certificate-only edit.');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await page.getByText('Draft saved. No certificate number has been allocated.').waitFor();
 if((await page.evaluate(()=>window.testState.versions[0].text_content.certification_statement))!=='Edited directly in the original certificate.')throw new Error('Editing a certificate overwrote official wording');
 await page.getByRole('button',{name:'Records & Batches',exact:true}).click();
 await page.getByRole('button',{name:'View / Print',exact:true}).click();
 const printFrame=page.frameLocator('iframe[title="Certificate preview"]');
 await printFrame.locator('.award-name').getByText('Synthetic Issued').waitFor();
 const previewSignature=await printFrame.locator('.signature-image').getAttribute('src');
 await page.evaluate(()=>{
   const open=window.open.bind(window);
   window.open=(...args)=>{
     const popup=open(...args);
     if(popup) popup.print=()=>{popup.document.documentElement.dataset.printRequested='true'};
     return popup;
   };
 });
 const popupEvent=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Print / Save PDF'}).click();
 const printPage=await popupEvent;
 await printPage.waitForFunction(()=>document.documentElement.dataset.printRequested==='true');
 if(await printPage.locator('.toolbar').count())throw new Error('Standalone print window includes template controls');
 if(await printPage.locator('.title-first').innerText()!=='Certificate of'||(await printPage.locator('.title-main').innerText()).trim()!=='Contribution')throw new Error('Full certificate title was duplicated or lost');
 if(await printPage.locator('.award-name').innerText()!=='Synthetic Issued'||await printPage.locator('.signature-image').getAttribute('src')!==previewSignature)throw new Error('The issued recipient or signature changed in print');
 if(!await printPage.getByText('EML-CON-2026-000001',{exact:true}).count()||!await printPage.getByText('Synthetic issued wording.',{exact:true}).count())throw new Error('The issued snapshot or number was lost');
 await printPage.emulateMedia({media:'print'});
 const printStyle=await printPage.locator('.certificate').evaluate(el=>({
   paper:getComputedStyle(el,'::before').backgroundImage,
   signature:getComputedStyle(el.querySelector('.signature-image')).mixBlendMode,
 }));
 if(printStyle.paper!=='none'||printStyle.signature!=='normal')throw new Error('Print-specific compositing is not active');
 const pdf=await printPage.pdf({path:'synthetic-certificate.pdf',preferCSSPageSize:true});
 if(pdf.length<10000||pdf.subarray(0,4).toString()!=='%PDF')throw new Error('Print PDF output is invalid');
 const info=execFileSync('pdfinfo',['synthetic-certificate.pdf'],{encoding:'utf8'});
 if(!/Pages:\s+1\b/.test(info)||!/Page size:\s+84[01](\.\d+)? x 59[45](\.\d+)? pts/.test(info))throw new Error('PDF is not one A4 landscape page');
 if(process.env.CREDENTIAL_PRINT_TEST_OUTPUT){
   const fs=await import('node:fs/promises');
   await fs.writeFile(process.env.CREDENTIAL_PRINT_TEST_OUTPUT+'.pdf',pdf);
   await fs.writeFile(process.env.CREDENTIAL_PRINT_TEST_OUTPUT+'.html',await printPage.content());
 }
 await printPage.close();
 await page.getByRole('button',{name:'Edit draft'}).click();
 await page.getByText('Draft opened for editing.').waitFor();
 if(await page.getByRole('textbox',{name:'Recipient name',exact:true}).inputValue()!=='Edited In Certificate')throw new Error('Saved draft did not reopen');
 await page.getByRole('button',{name:'Records & Batches',exact:true}).click();
 await page.getByRole('button',{name:'Preview',exact:true}).last().click();
 await page.getByRole('button',{name:'Mark reviewed'}).waitFor({state:'visible'});
 await page.getByRole('button',{name:'Mark reviewed'}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Confirm manual layout review'}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Issue certificates'}).click();
 await page.waitForFunction(()=>window.testState.batches.some(b=>b.id!=='issued-batch'&&b.status==='issued'));
 await page.getByRole('button',{name:'Certificate Editor',exact:true}).click();
 await page.getByText('This issued batch is read-only.',{exact:false}).waitFor();
 if(!await page.getByRole('textbox',{name:'Recipient name',exact:true}).isDisabled())throw new Error('Issued content is still editable');
 await page.getByRole('button',{name:'Start a new draft from this content'}).click();
 if(await page.getByRole('textbox',{name:'Recipient name',exact:true}).isDisabled())throw new Error('Starting a new draft remained locked');
 await page.getByRole('button',{name:'Bulk Issuance',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('select')].some(item=>item.value==='wording-1'));
 await page.getByRole('button',{name:'Choose sources',exact:true}).click();
 await page.getByText('Synthetic Author · Synthetic Research',{exact:false}).click();
 await page.getByLabel('I verified this exact person against the paper byline.').check();
 await page.getByRole('button',{name:'Add selected · 1'}).click();
 if(await page.getByLabel('Recipient Name 1').inputValue()!=='Synthetic Author')throw new Error('Source selection failed');
 await page.getByLabel('Recipient Name 1').fill('Synthetic Alias');
 await page.getByRole('textbox',{name:'Certificate title',exact:true}).fill('CONTRIBUTION');
 await page.getByRole('textbox',{name:'Certification statement',exact:true}).fill('Verified research contribution.');
 await page.getByRole('button',{name:'Add recipient',exact:true}).click();
 await page.getByLabel('Recipient Name 2').evaluate(el=>{const dt=new DataTransfer();dt.setData('text/plain','Second Recipient\tDirector\tResearch\nThird Recipient\tAnalyst\tOperations');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 if(await page.getByLabel('Role / Position 2').inputValue()!=='Director'||await page.getByLabel('Recipient Name 3').inputValue()!=='Third Recipient')throw new Error('Spreadsheet paste failed');
 await page.getByRole('button',{name:'Next recipient'}).click();
 await page.getByRole('button',{name:'Previous recipient'}).click();
 if(await page.getByRole('textbox',{name:'Recipient name',exact:true}).inputValue()!=='Synthetic Alias')throw new Error('Recipient switch lost data');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await page.getByText('Draft saved. No certificate number has been allocated.').waitFor();
 const result=await page.evaluate(()=>window.testState.last);
 if(result.p_source_refs[0].id!=='paper-1'||result.p_entries[0].user_id)throw new Error('Research source lost or unverified uploader linked');
 if(result.p_entries[1].name!=='Second Recipient')throw new Error('Bulk recipients overwritten');
 if(result.p_entries[2].name!=='Third Recipient')throw new Error('Pasted recipient missing');
 await page.locator('input[type="file"]').setInputFiles({name:'recipients.csv',mimeType:'text/csv',buffer:Buffer.from('name,role\nCSV Person,Editor\n')});
 await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='CSV Person'));
 await page.locator('input[type="file"]').setInputFiles(XLSX_PATH);
 await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Test Person'));
 await page.getByRole('button',{name:'Choose sources',exact:true}).click();
 await page.getByText('Synthetic Leader · Director',{exact:false}).click();
 await page.getByRole('button',{name:'Add selected · 1'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Synthetic Leader'));
 await page.getByRole('button',{name:'Choose sources',exact:true}).click();
 await page.getByText('Matched Author · Linked Research',{exact:false}).click();
 await page.getByLabel('I verified this exact person against the paper byline.').check();
 await page.getByRole('button',{name:'Add selected · 1'}).click();
 const matchedInput=page.locator('input[aria-label^="Recipient Name"]').last();
 if(await matchedInput.inputValue()!=='Matched Author')throw new Error('Linked research author not added');
 await matchedInput.fill('Confirmed Alias');
 await page.getByLabel('I verified that 1 changed display name(s) still identify the linked account(s).').check();
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await page.waitForFunction(()=>window.testState.last?.p_entries?.some(entry=>entry.name==='Confirmed Alias'));
 const linked=await page.evaluate(()=>window.testState.last);
 const linkedIndex=linked.p_entries.findIndex(entry=>entry.name==='Confirmed Alias');
 if(linkedIndex<0||linked.p_entries[linkedIndex].user_id!=='00000000-0000-4000-8000-000000000006'||linked.p_source_refs[linkedIndex].id!=='paper-2')throw new Error('Name edit lost the research source or linked the wrong account');
 const countBefore=await page.locator('input[aria-label^="Recipient Name"]').count();
 await page.getByRole('button',{name:'Choose sources',exact:true}).click();
 await page.getByText('Synthetic Author · Synthetic Research',{exact:false}).click();
 await page.getByLabel('I verified this exact person against the paper byline.').check();
 await page.getByText('Synthetic Leader · Director',{exact:false}).click();
 await page.getByRole('button',{name:'Add selected · 2'}).click();
 if(await page.locator('input[aria-label^="Recipient Name"]').count()!==countBefore+2)throw new Error('Multiple selected sources were not added');
 const originalContribution=await page.getByLabel('Contribution 1').inputValue();
 await page.getByLabel('Contribution 1').evaluate(el=>{const dt=new DataTransfer();dt.setData('text/plain','one\ttwo\tthree');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 await page.getByText('The pasted cells exceed the row, column or text limits. No cells were changed.').waitFor();
 if(await page.getByLabel('Contribution 1').inputValue()!==originalContribution)throw new Error('Invalid paste partially modified recipients');
 if(await page.evaluate(()=>window.testState.assetLoads)!==1)throw new Error('Approved private assets were fetched repeatedly');
 console.log('PASS: approved visual regression, inline editing, draft recovery, source selection, and bulk isolation');
} catch(error) { if(page){console.error('SYNTHETIC_PAGE_STATE', (await page.locator('body').innerText()).slice(0,5000));console.error('SYNTHETIC_LABELS',await page.locator('label').evaluateAll(items=>items.map(x=>({text:x.textContent,control:x.control?.outerHTML.slice(0,250)}))));} throw error; }
finally {await browser.close()}
'''.replace('PLAYWRIGHT_PATH',json.dumps(PLAYWRIGHT.as_uri())).replace('BASE_URL',json.dumps(f'http://127.0.0.1:{port}/admin/credentials')).replace('BASELINE_URL',json.dumps(f'http://127.0.0.1:{port}/baseline')).replace('XLSX_PATH',json.dumps(str(ROOT / 'tests/fixtures/credential-import.xlsx'))).replace('SCREENSHOT_PATH',json.dumps(os.environ.get('CREDENTIAL_UI_SCREENSHOT','')))
        test = tmp / 'run-ui.mjs'; test.write_text(script)
        subprocess.run(['node',str(test)],cwd=tmp,env=env,check=True,timeout=180)
    finally:
        server.terminate()
        try: server.wait(timeout=10)
        except subprocess.TimeoutExpired: server.kill();server.wait()
        server_log.close()
