"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { CredentialCanvas } from "./credential-canvas";
import { CredentialSignatureSelect } from "./credential-signature-select";
import type { WordingSeed } from "./credential-wording-library";
import type { VisualAssets } from "@/lib/credentials/browser-print";
import { parseCredentialCsv, recipientsFromRows, type ImportedRecipient } from "@/lib/credentials/import";
import { CREDENTIAL_CATEGORIES, WORDING_FIELDS, blankWording, wordingFrom, type CategoryCode, type WordingContent, type WordingVersion } from "@/lib/credentials/wording";
import { type CredentialSignatureKey } from "@/lib/credentials/signatures";
import type { CredentialResearchSource } from "@/lib/supabase/credential-research-sources";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";

type OrganizationSource = { id: string; name: string; title: string; organizational_group: string };
type SourceRef = { kind?: string; id?: string; label?: string; linked_name?: string };
type WordingRef = { type?: "library" | "legacy"; id?: string; modified?: boolean };
type Row = { entry: ImportedRecipient; wording: WordingContent; source: SourceRef; wordingRef: WordingRef };
type Initial = { id?: string; recipient?: ImportedRecipient; category?: CategoryCode; subtype?: string; wording?: Partial<WordingContent>; source?: SourceRef; wordingRef?: WordingRef; signature?: CredentialSignatureKey; authority?: string } | null;
type LegacyTemplate = { id: string; category: string; subtype: string; version: number; active: boolean; text_content: Partial<WordingContent> };
type Props = {
  bulk: boolean; visible: boolean; loadAssets: () => Promise<VisualAssets>; versions: WordingVersion[]; batches: {id:string;status:string}[]; organization: OrganizationSource[]; research: CredentialResearchSource[];
  legacy: LegacyTemplate[]; initial: Initial; onLoaded: () => void; onSaved: () => Promise<void>; onRecords: () => void; onSaveWording: (seed: WordingSeed) => void;
};
type RenderData = { status: string; entries: ImportedRecipient[]; category: CategoryCode; subtype: string; issue_date: string; issuing_authority: string; signature_key: CredentialSignatureKey; template: Partial<WordingContent>; editor: { wordings: WordingContent[]; source_refs: SourceRef[]; wording_refs: WordingRef[]; revision: number } | null };
const input = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]";
const button = "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--canvas)] disabled:opacity-50";
const ghost = "rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold disabled:opacity-50";
const columns: { key: keyof ImportedRecipient; label: string }[] = [
  {key:"name",label:"Recipient Name"},{key:"role",label:"Role / Position"},{key:"department",label:"Department"},
  {key:"project",label:"Project"},{key:"contribution",label:"Contribution"},{key:"service_period",label:"Service Period"},
];
function emptyEntry(): ImportedRecipient { return {name:"",role:"",department:"",project:"",contribution:"",service_period:""}; }
function emptyRow(): Row { return {entry:emptyEntry(),wording:blankWording(),source:{},wordingRef:{}}; }
function retainLinkedName(source: SourceRef | undefined, entry: ImportedRecipient): SourceRef {
  const result = { ...source };
  if (entry.user_id && !result.linked_name) result.linked_name = entry.name;
  return result;
}
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; };
function layoutField(problem: string) {
  return problem.replaceAll(".award-name", "Recipient name").replaceAll(".award-role", "Role / position")
    .replaceAll(".award-copy", "Certification statement / contribution / service period")
    .replaceAll(".cert-heading", "Certificate title").replaceAll(".title-main", "Certificate title").replaceAll(".scope", "Department / project")
    .replaceAll(".footer-value", "Date / certificate number").replaceAll("#issuingAuthority", "Issuing authority");
}

export function CredentialVisualEditor({ bulk, visible, loadAssets, versions, batches, legacy, organization, research, initial, onLoaded, onSaved, onRecords, onSaveWording }: Props) {
  const [category,setCategory] = useState<CategoryCode>(() => initial?.category ?? "LEA"); const [subtype,setSubtype] = useState(() => initial?.subtype ?? "Initial Founder");
  const [templateId,setTemplateId] = useState(() => initial?.wordingRef?.id ?? ""); const [authority,setAuthority] = useState(() => initial?.authority ?? "EconMind Founder Team");
  const [signature,setSignature] = useState<CredentialSignatureKey>(() => initial?.signature ?? "samuel_qian_v1"); const [date,setDate] = useState(today);
  const [dateError,setDateError] = useState(false);
  const [rows,setRows] = useState<Row[]>(() => initial?.recipient ? [{entry:initial.recipient,wording:wordingFrom(initial.wording),source:retainLinkedName(initial.source,initial.recipient),wordingRef:initial.wordingRef ?? {}}] : [emptyRow()]); const [index,setIndex] = useState(0); const [mode,setMode] = useState<"blank"|"filled"|"review">("filled");
  const [step,setStep] = useState(0); const [batchId,setBatchId] = useState<string|null>(null); const [revision,setRevision] = useState(0);
  const [busy,setBusy] = useState(() => Boolean(initial?.id)); const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  const [assets,setAssets] = useState<VisualAssets|null>(null); const [sourceOpen,setSourceOpen] = useState(false);
  const [sourceFilter,setSourceFilter] = useState("all"); const [sourceQuery,setSourceQuery] = useState(""); const [checked,setChecked] = useState<string[]>([]);
  const [warnings,setWarnings] = useState<Record<number,string[]>>({}); const [allowDuplicates,setAllowDuplicates] = useState(false);
  const [verifiedLinkedNames,setVerifiedLinkedNames] = useState(false);
  const requestKey = useRef<string|null>(null);
  const autoApplied = useRef("");
  const group = CREDENTIAL_CATEGORIES.find(item => item.code===category)!;
  const choices = [
    ...versions.filter(item => item.category===category && item.subtype===subtype),
    ...legacy.filter(item => item.category===category && item.subtype===subtype && (item.active || item.id===templateId)).map(item => ({...item,template_name:item.active?"Existing active version":"Existing inactive version",status:"legacy" as const})),
  ];
  const selected = choices.find(item => item.id===templateId) ?? null;
  const selectedRow = rows[Math.min(index,rows.length-1)] ?? emptyRow();
  const names = rows.map(row => row.entry.name.trim().toLocaleLowerCase()).filter(Boolean);
  const duplicates = new Set(names).size!==names.length;
  const changedLinkedNames = rows.filter(row => row.entry.user_id && row.source.linked_name && row.entry.name.trim() !== row.source.linked_name.trim()).length;
  const missing = rows.filter(row => !row.entry.name.trim() || !row.wording.title.trim() || !row.wording.certification_statement.trim()).length;
  const currentProblems = warnings[index] ?? [];
  const batchStatus = batchId ? batches.find(batch => batch.id === batchId)?.status : undefined;
  const locked = Boolean(batchId && batchStatus !== "draft");
  const warningCount = Object.values(warnings).filter(items => items.length).length;
  const checkedCount = Object.keys(warnings).length;
  const ready = rows.filter((row,i) => row.entry.name.trim() && row.wording.title.trim() && row.wording.certification_statement.trim() && warnings[i]?.length===0).length;
  const baseWording = selected ? wordingFrom(selected.text_content) : blankWording();
  const model = useMemo(() => ({ batch:{ issue_date:date || today(), issuing_authority:authority, signature_key:signature, category, subtype, template:selectedRow.wording }, recipient:selectedRow.entry, wording:selectedRow.wording }),[date,authority,signature,category,subtype,selectedRow]);
  const onProblems = useCallback((items: string[]) => setWarnings(previous => {
    if (mode === "blank") return previous;
    if (JSON.stringify(previous[index])===JSON.stringify(items)) return previous;
    return {...previous,[index]:items};
  }),[index,mode]);

  useEffect(() => {
    let active=true;
    void loadAssets().then(data => { if(active) setAssets(data); }).catch(() => { if(active) setError("The approved certificate could not be loaded."); });
    return () => {active=false;};
  },[loadAssets]);
  useEffect(() => {
    if (initial || batchId || templateId || rows.some(row => Object.values(row.wording).some(Boolean))) return;
    const firstApproved = versions.find(item => item.category === category && item.subtype === subtype && item.status === "approved");
    if (!firstApproved || autoApplied.current === firstApproved.id) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) { autoApplied.current = firstApproved.id; setTemplateId(firstApproved.id); setRows(old => old.map(row => ({...row,wording:wordingFrom(firstApproved.text_content),wordingRef:{type:"library",id:firstApproved.id,modified:false}}))); }
    });
    return () => { active = false; };
  }, [versions, category, subtype, templateId, rows, initial, batchId]);
  useEffect(() => {
    if (!initial) return;
    if (initial.recipient) return;
    if (!initial.id) return;
    let active=true;
    void Promise.resolve(requireSupabaseBrowserClient().rpc("get_credential_editor_render_data",{p_batch_id:initial.id,p_credential_id:null})).then(({data,error:failure}) => {
      if (!active) return;
      if (failure) { setError(failure.message); return; }
      const value=data as RenderData; const editable=value.status==="draft";
      setCategory(value.category); setSubtype(value.subtype); setDate(value.issue_date); setAuthority(value.issuing_authority); setSignature(value.signature_key);
      setDateError(false);
      setRows(value.entries.map((entry,i) => ({entry,wording:wordingFrom(value.editor?.wordings[i] ?? value.template),source:retainLinkedName(value.editor?.source_refs[i],entry),wordingRef:value.editor?.wording_refs?.[i] ?? {}})));
      setTemplateId(value.editor?.wording_refs?.[0]?.id ?? "");
      setIndex(0); setWarnings({}); setBatchId(editable ? initial.id! : null); setRevision(editable ? value.editor?.revision ?? 0 : 0); requestKey.current=null;
      setNotice(editable ? "Draft opened for editing." : "Reviewed or issued records are locked; this is a new draft based on the saved content.");
      setBusy(false); onLoaded();
    }).catch(() => {if(active)setError("The draft could not be loaded.");}).finally(() => {if(active)setBusy(false);});
    return () => {active=false;};
  },[initial,onLoaded]);
  function updateRow(i:number, update:(row:Row)=>Row) {
    setRows(old => old.map((row,n) => n===i ? update(row):row));
    setWarnings(old => {const next={...old};delete next[i];return next;}); setAllowDuplicates(false); setVerifiedLinkedNames(false);
  }
  function updateEntry(i:number,key:keyof ImportedRecipient,value:string) {
    updateRow(i,row => ({...row,entry:{...row.entry,[key]:value}}));
  }
  function updateWording(i:number,key:keyof WordingContent,value:string) { updateRow(i,row=>({...row,wording:{...row.wording,[key]:value},wordingRef:row.wordingRef.id?{...row.wordingRef,modified:true}:row.wordingRef})); }
  function selectRecipient(next: number) { setIndex(next); setTemplateId(rows[next]?.wordingRef.id ?? ""); }
  function applyWord(wording:WordingContent, all:boolean, ref:WordingRef = {}) {
    setRows(old => old.map((row,i) => all || i===index ? {...row,wording:wordingFrom(wording),wordingRef:{...ref}} : row)); setWarnings({});
  }
  function chooseSubtype(categoryValue: CategoryCode, subtypeValue: string) {
    setCategory(categoryValue); setSubtype(subtypeValue);
    const approved = versions.find(item => item.category === categoryValue && item.subtype === subtypeValue && item.status === "approved");
    setTemplateId(approved?.id ?? ""); applyWord(approved ? wordingFrom(approved.text_content) : blankWording(), true, approved ? {type:"library",id:approved.id,modified:false} : {}); setWarnings({});
  }
  function chooseCategory(value:CategoryCode) {chooseSubtype(value,CREDENTIAL_CATEGORIES.find(item=>item.code===value)!.subtypes[0]);}
  function chooseTemplate(value:string) {
    setTemplateId(value); const found=choices.find(item=>item.id===value);
    if(found) applyWord(wordingFrom(found.text_content),bulk,{type:found.status==="legacy"?"legacy":"library",id:found.id,modified:false});
    else setRows(old => old.map((row,i) => bulk || i===index ? {...row,wordingRef:{}} : row));
  }
  function addRows(entries:Row[], replaceEmpty = true) {
    const replace = replaceEmpty && rows.length===1 && !Object.values(rows[0].entry).some(Boolean) && !rows[0].source.id;
    if ((replace ? 0 : rows.length) + entries.length > 500) { setError("A batch can contain at most 500 recipients. No rows were added."); return false; }
    setRows(old => replace ? entries : [...old,...entries]);setWarnings({});setVerifiedLinkedNames(false);return true;
  }
  async function importFile(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error("The file must be 5 MB or less.");
      const table=file.name.toLowerCase().endsWith(".csv") ? parseCredentialCsv(await file.text()) : file.name.toLowerCase().endsWith(".xlsx") ? await (await import("read-excel-file/browser")).readSheet(file) : null;
      if(!table)throw new Error("Choose a CSV or XLSX file.");
      if(addRows(recipientsFromRows(table).map(entry=>({entry,wording:wordingFrom(selectedRow.wording),source:{kind:"import",label:file.name},wordingRef:{...selectedRow.wordingRef}}))))setError("");
    } catch(cause) {setError(cause instanceof Error?cause.message:"Import failed.");}
  }
  function pasteCells(event:ClipboardEvent<HTMLInputElement>,rowIndex:number,columnIndex:number) {
    const text=event.clipboardData.getData("text/plain"); if(!text.includes("\t")&&!text.includes("\n"))return;
    event.preventDefault(); const cells=text.replace(/\r\n?/g,"\n").split("\n").filter((line,i,all)=>line || i<all.length-1).map(line=>line.split("\t"));
    if (rowIndex+cells.length>500 || cells.some(line => columnIndex+line.length>columns.length || line.some((value,j) => value.length>(columns[columnIndex+j]?.key==="name"?200:4000)))) {
      setError("The pasted cells exceed the row, column or text limits. No cells were changed."); return;
    }
    setRows(old=>{const copy=old.map(row=>({...row,entry:{...row.entry}}));cells.forEach((line,i)=>{const target=rowIndex+i;while(copy.length<=target)copy.push({...emptyRow(),wording:wordingFrom(copy[rowIndex].wording),wordingRef:{...copy[rowIndex].wordingRef}});line.forEach((value,j)=>{copy[target].entry[columns[columnIndex+j].key]=value;});});return copy;});setWarnings({});setAllowDuplicates(false);setVerifiedLinkedNames(false);setError("");
  }
  function addSources() {
    const items:Row[]=[];
    for(const person of organization)if(checked.includes(`org:${person.id}`))items.push({entry:{...emptyEntry(),name:person.name,role:person.title,department:person.organizational_group},wording:wordingFrom(selectedRow.wording),source:{kind:"organization",id:person.id,label:person.title},wordingRef:{...selectedRow.wordingRef}});
    for(const paper of research)if(checked.includes(`research:${paper.paper_id}`) && paper.author_display_name?.trim())items.push({entry:{...emptyEntry(),name:paper.author_display_name,project:paper.title,...(paper.owner_name_matches===true && paper.uploader_user_id?{user_id:paper.uploader_user_id}:{})},wording:wordingFrom(selectedRow.wording),source:{kind:"research",id:paper.paper_id,label:paper.title,...(paper.owner_name_matches===true && paper.uploader_user_id?{linked_name:paper.author_display_name}:{})},wordingRef:{...selectedRow.wordingRef}});
    if(items.length) {
      if (bulk) { if (!addRows(items)) return; }
      else { setRows([items[0]]); setIndex(0); setWarnings({}); }
    }
    setSourceOpen(false);setChecked([]);
  }
  function goStep(next: number) {
    setStep(next);
    const target = ["credential-template-controls", "credential-add-recipients", "credential-recipient-table", "credential-live-canvas", "credential-bulk-review"][next];
    window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }
  async function save() {
    setError("");setNotice("");
    if(locked){setError("This batch is locked. Start a new draft to make changes.");return;}
    if(rows.some(row=>!row.entry.name.trim())) {setError("Every recipient needs a name before saving.");return;}
    if(duplicates&&!allowDuplicates){setError("Review duplicate names and confirm the recipients.");return;}
    if(changedLinkedNames&&!verifiedLinkedNames){setError("Confirm the changed display names still identify their linked accounts, or unlink those accounts.");return;}
    if(!date || dateError){setError("Enter a valid issue date before saving.");return;}
    setBusy(true);if(!requestKey.current)requestKey.current=crypto.randomUUID();
    try {
      const {data,error:failure}=await requireSupabaseBrowserClient().rpc("save_credential_editor_draft",{
        p_batch_id:batchId,p_expected_revision:revision,p_request_key:requestKey.current,p_category:category,p_subtype:subtype,
        p_issue_date:date,p_issuing_authority:authority,p_signature_key:signature,p_entries:rows.map(row=>row.entry),p_wordings:rows.map(row=>row.wording),p_source_refs:rows.map(row=>row.source),p_wording_refs:rows.map(row=>row.wordingRef),
      });
      if(failure)throw failure;const result=data as {id:string;revision:number};setBatchId(result.id);setRevision(result.revision);requestKey.current=null;
      await onSaved();setNotice("Draft saved. No certificate number has been allocated.");
    } catch(cause){setError(cause instanceof Error?cause.message:"Could not save draft.");} finally{setBusy(false);}
  }
  return <section className="mt-7 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">{bulk?"Bulk Issuance":"Certificate Editor"}</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">{batchId?`Editing saved draft · revision ${revision}`:"New draft · numbers are assigned only when issued"}</p></div><button className={ghost} onClick={onRecords}>Records &amp; batches</button></div>
    {error&&<p role="alert" className="rounded-lg border border-[var(--red)] p-3 text-sm text-[var(--red)]">{error}</p>}{notice&&<p role="status" className="rounded-lg border border-[var(--line)] p-3 text-sm">{notice}</p>}
    {locked && <div className="rounded-lg border border-[var(--line)] p-3 text-sm">This {batchStatus ?? "unavailable"} batch is read-only. <button type="button" className="underline" onClick={() => {setBatchId(null);setRevision(0);requestKey.current=null;setNotice("A new draft has been started from the displayed content.");}}>Start a new draft from this content</button></div>}
    {bulk&&<div className="space-y-3"><div className="flex flex-wrap gap-2">{["1 · Select template","2 · Add recipients","3 · Edit recipients","4 · Visual preview","5 · Review & issue"].map((label,i)=><button type="button" key={label} aria-pressed={step===i} onClick={()=>goStep(i)} className={step===i?button:ghost}>{label}</button>)}</div><div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-muted)]"><span>{["Select category, wording, authority and date.","Add people manually, from sources or by importing a file.","Edit recipients in the table and fill shared fields.","Preview each recipient and resolve layout warnings.","Save the draft and complete the existing review and issuance process."][step]}</span><button type="button" className={ghost} disabled={step===0} onClick={()=>goStep(step-1)}>Previous step</button><button type="button" className={ghost} disabled={step===4} onClick={()=>goStep(step+1)}>Next step</button></div></div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.6fr)]">
      <fieldset disabled={busy || locked || mode === "review"} id="credential-template-controls" className="min-w-0 space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h3 className="text-lg font-bold">Text &amp; template controls</h3>
        <label className="block text-sm font-semibold">Category<select className={input} value={category} onChange={e=>chooseCategory(e.target.value as CategoryCode)}>{CREDENTIAL_CATEGORIES.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        <label className="block text-sm font-semibold">Subtype<select className={input} value={subtype} onChange={e=>chooseSubtype(category,e.target.value)}>{group.subtypes.map(item=><option key={item}>{item}</option>)}{!group.subtypes.some(item=>item===subtype)&&<option>{subtype}</option>}</select></label>
        <label className="block text-sm font-semibold">Wording template<select className={input} value={templateId} onChange={e=>chooseTemplate(e.target.value)}><option value="">Unconfigured · manual wording</option>{choices.map(item=><option key={item.id} value={item.id}>{item.template_name} · v{item.version} · {item.status}</option>)}</select></label>
        {!selected&&<p className="text-sm text-[var(--ink-muted)]">Official wording not configured.</p>}{selected?.status==="draft"&&<p className="text-sm text-amber-500">Draft wording is not an approved template.</p>}{selected?.status==="archived"&&<p className="text-sm text-amber-500">This wording version is archived.</p>}{selected?.status==="legacy"&&<p className="text-sm text-[var(--ink-muted)]">Existing version; separate V2 approval has not been recorded.</p>}
        {selectedRow.wordingRef.modified && <p className="text-sm text-[var(--ink-muted)]">This certificate has edits based on the selected version; the template remains unchanged.</p>}
        <div className="flex flex-wrap gap-2"><button type="button" className={ghost} disabled={!selected} onClick={()=>applyWord(baseWording,bulk,selected?{type:selected.status==="legacy"?"legacy":"library",id:selected.id,modified:false}:{})}>Apply Template</button><button type="button" className={ghost} onClick={()=>applyWord(baseWording,bulk,selected?{type:selected.status==="legacy"?"legacy":"library",id:selected.id,modified:false}:{})}>Reset to Template</button><button type="button" className={ghost} onClick={()=>onSaveWording({category,subtype,wording:selectedRow.wording})}>Save as Draft Wording</button></div>
        <p className="text-xs text-[var(--ink-muted)]">Edit Current Wording below. Changes affect this certificate draft, not the official template.</p>
        <label className="block text-sm font-semibold">Recipient name<input className={input} maxLength={200} value={selectedRow.entry.name} onChange={e=>updateEntry(index,"name",e.target.value)} /></label>
        {selectedRow.entry.user_id&&<div className="text-xs text-[var(--ink-muted)]">Article account linked. Changing the display name retains its source and link; verify identity. <button className="underline" type="button" onClick={()=>updateRow(index,row=>{const entry={...row.entry};delete entry.user_id;return {...row,entry};})}>Unlink account</button></div>}
        <label className="block text-sm font-semibold">Role / position<input className={input} value={selectedRow.entry.role} maxLength={4000} onChange={e=>updateEntry(index,"role",e.target.value)} /></label>
        {selectedRow.source.id && <p className="text-xs text-[var(--ink-muted)]">Source: {selectedRow.source.kind} · {selectedRow.source.label} · {selectedRow.source.id}</p>}
        {!bulk && columns.filter(column => !["name", "role"].includes(column.key)).map(column => <label key={column.key} className="block text-sm font-semibold">{column.label}<input className={input} value={selectedRow.entry[column.key] ?? ""} maxLength={4000} onChange={e => updateEntry(index,column.key,e.target.value)} /></label>)}
        {WORDING_FIELDS.map(item=><label key={item.key} className="block text-sm font-semibold">{item.label}{item.multiline?<textarea aria-label={item.label} className={input} value={selectedRow.wording[item.key]} placeholder={item.placeholder} maxLength={4000} onChange={e=>updateWording(index,item.key,e.target.value)} />:<input aria-label={item.label} className={input} value={selectedRow.wording[item.key]} placeholder={item.placeholder} maxLength={4000} onChange={e=>updateWording(index,item.key,e.target.value)} />}</label>)}
        <label className="block text-sm font-semibold">Issue date<input type="date" className={input} value={date} onChange={e=>{setDate(e.target.value);setDateError(false);setWarnings({});}} /></label>
        <label className="block text-sm font-semibold">Issuing authority<select className={input} value={authority} onChange={e=>{setAuthority(e.target.value);setWarnings({});}}><option>EconMind Founder Team</option><option>EconMind Leadership Group</option></select></label>
        <CredentialSignatureSelect value={signature} onChange={value=>{setSignature(value);setWarnings({});}} />
        {duplicates&&<label className="block text-sm text-amber-500"><input type="checkbox" checked={allowDuplicates} onChange={e=>setAllowDuplicates(e.target.checked)} /> I verified these duplicate names are intended.</label>}
        {changedLinkedNames>0&&<label className="block text-sm text-amber-500"><input type="checkbox" checked={verifiedLinkedNames} onChange={e=>setVerifiedLinkedNames(e.target.checked)} /> I verified that {changedLinkedNames} changed display name(s) still identify the linked account(s).</label>}
        <button type="button" className={button} disabled={busy} onClick={()=>void save()}>Save draft</button>
      </fieldset>
      <div id="credential-live-canvas" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">Live Certificate Canvas</h3><div className="flex flex-wrap gap-2">{([["blank","Blank Template"],["filled","Filled Preview"],["review","Final Review"]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={mode===value} className={mode===value?button:ghost} onClick={()=>setMode(value)}>{label}</button>)}</div></div>
        {dateError && <p role="alert" className="rounded-lg border border-[var(--red)] p-3 text-sm text-[var(--red)]">Issue date is invalid. Correct the date before saving.</p>}
        {currentProblems.length>0&&<p role="alert" className="rounded-lg border border-[var(--red)] p-3 text-sm text-[var(--red)]">Text exceeds the approved certificate layout. {currentProblems.map(layoutField).join(", ")}</p>}
        {visible && <CredentialCanvas key={`${index}:${mode}:${busy}:${locked}`} assets={assets} model={model} mode={busy || locked ? "review" : mode} onRecipient={(key,value)=>updateEntry(index,key,value)} onWording={(key,value)=>updateWording(index,key,value)} onDate={value=>{setDate(value);setWarnings({});}} onDateError={setDateError} onProblems={onProblems} />}
        {bulk&&<div className="flex flex-wrap items-center gap-3"><button type="button" className={ghost} disabled={index===0} onClick={()=>selectRecipient(index-1)}>Previous recipient</button><span className="text-sm">{index+1} / {rows.length} · {selectedRow.entry.name||"Unnamed"}</span><button type="button" className={ghost} disabled={index>=rows.length-1} onClick={()=>selectRecipient(index+1)}>Next recipient</button></div>}
      </div>
    </div>
    {bulk&&<section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><fieldset disabled={busy || locked || mode === "review"} className="space-y-4"><div id="credential-add-recipients" className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Recipients</h3><p className="text-sm text-[var(--ink-muted)]">Edit cells directly; paste tab-separated cells from a spreadsheet.</p></div><div className="flex gap-2"><button className={ghost} type="button" onClick={()=>addRows([{...emptyRow(),wording:wordingFrom(selectedRow.wording),wordingRef:{...selectedRow.wordingRef}}],false)}>Add recipient</button><button className={ghost} type="button" onClick={()=>setSourceOpen(true)}>Choose sources</button><label className={`${ghost} cursor-pointer`}>Import CSV / XLSX<input className="sr-only" type="file" accept=".csv,.xlsx" onChange={e=>void importFile(e)} /></label></div></div>
      <div id="credential-recipient-table" className="overflow-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr><th className="p-2">#</th>{columns.map(column=><th className="p-2" key={column.key}>{column.label}</th>)}<th /></tr></thead><tbody>{rows.map((row,i)=><tr key={i} className={i===index?"bg-[var(--accent-soft)]":""}><td className="p-2"><button type="button" className="underline" onClick={()=>selectRecipient(i)}>{i+1}</button></td>{columns.map((column,j)=><td key={column.key} className="p-1"><input aria-label={`${column.label} ${i+1}`} className={input} value={row.entry[column.key]??""} maxLength={column.key === "name" ? 200 : 4000} onFocus={()=>selectRecipient(i)} onChange={e=>updateEntry(i,column.key,e.target.value)} onPaste={e=>pasteCells(e,i,j)} /></td>)}<td><button type="button" className="px-2 text-[var(--red)]" disabled={rows.length===1} onClick={()=>{const remaining=rows.filter((_,n)=>n!==i);const next=Math.min(index,remaining.length-1);setRows(remaining);setIndex(next);setTemplateId(remaining[next]?.wordingRef.id??"");setWarnings({});}}>Remove</button></td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-3">{columns.filter(column=>column.key!=="name").map(column=><button type="button" className={ghost} key={column.key} onClick={()=>{const value=selectedRow.entry[column.key]??"";setRows(old=>old.map(row=>({...row,entry:{...row.entry,[column.key]:value}})));setWarnings({});}}>Fill {column.label} from selected</button>)}</div>
      <div id="credential-bulk-review"><p className="text-sm">Total Recipients: {rows.length} · Ready: {ready} · Missing Information: {missing} · Layout Warnings: {warningCount} · Not yet checked: {rows.length-checkedCount}</p>
      {step===4&&<p className="mt-2 text-sm text-[var(--ink-muted)]">Save the draft, then review every recipient and use the existing review and issuance controls in Records &amp; Batches.</p>}</div>
    </fieldset></section>}
    {!bulk&&<button type="button" className={ghost} disabled={busy || locked || mode === "review"} onClick={()=>setSourceOpen(true)}>Choose organization or research source</button>}
    {sourceOpen&&<div role="dialog" aria-modal="true" aria-label="Choose sources" className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"><div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex justify-between"><h3 className="text-xl font-bold">Source picker</h3><button type="button" onClick={()=>setSourceOpen(false)}>Close</button></div><p className="mt-2 text-sm text-[var(--ink-muted)]">Research authors and uploader accounts are separate. Accounts are linked only when the article already links that account and the displayed name matches; source references remain when a name is edited.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input aria-label="Search sources" className={input} placeholder="Search name or research" value={sourceQuery} onChange={e=>setSourceQuery(e.target.value)} /><select aria-label="Filter sources" className={input} value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">All sources</option><option value="organization">Organization</option><option value="research">Research</option></select></div>{error && <p role="alert" className="mt-3 text-sm text-[var(--red)]">{error}</p>}<div className="mt-3 max-h-[45vh] overflow-auto">
      {(sourceFilter==="all"||sourceFilter==="organization")&&organization.filter(person=>`${person.name} ${person.title} ${person.organizational_group}`.toLowerCase().includes(sourceQuery.toLowerCase())).map(person=><label key={person.id} className="flex gap-2 border-b border-[var(--line)] py-3 text-sm"><input type="checkbox" checked={checked.includes(`org:${person.id}`)} onChange={e=>setChecked(old=>e.target.checked?[...old,`org:${person.id}`]:old.filter(item=>item!==`org:${person.id}`))} /><span>{person.name} · {person.title} · {person.organizational_group}</span></label>)}
      {(sourceFilter==="all"||sourceFilter==="research")&&research.filter(paper=>Boolean(paper.author_display_name?.trim()) && `${paper.author_display_name} ${paper.title}`.toLowerCase().includes(sourceQuery.toLowerCase())).map(paper=><label key={paper.paper_id} className="flex gap-2 border-b border-[var(--line)] py-3 text-sm"><input type="checkbox" checked={checked.includes(`research:${paper.paper_id}`)} onChange={e=>setChecked(old=>e.target.checked?[...old,`research:${paper.paper_id}`]:old.filter(item=>item!==`research:${paper.paper_id}`))} /><span>{paper.author_display_name} · {paper.title} {paper.owner_name_matches!==true&&"· uploader not linked"}</span></label>)}
      </div><button type="button" className={`${button} mt-4`} disabled={!checked.length || (!bulk && checked.length > 1)} onClick={addSources}>Add selected · {checked.length}</button>{!bulk && checked.length > 1 && <p className="mt-2 text-sm">Select one source for a single certificate.</p>}</div></div>}
  </section>;
}
