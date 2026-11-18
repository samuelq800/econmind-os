"use client";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { CREDENTIAL_CATEGORIES, WORDING_FIELDS, blankWording, wordingFrom, type CategoryCode, type WordingContent, type WordingVersion, type WordingCatalog } from "@/lib/credentials/wording";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";

const input = "mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)]";
const button = "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--canvas)] disabled:opacity-50";
export type WordingSeed = { category: CategoryCode; subtype: string; wording: WordingContent };
type LegacyTemplate = { id: string; category: string; subtype: string; version: number; active: boolean; text_content: Partial<WordingContent> };
type Props = { catalog: WordingCatalog; versions: WordingVersion[]; legacy: LegacyTemplate[]; refresh: () => Promise<void>; refreshLegacy: () => Promise<void>; seed: WordingSeed | null };

export function CredentialWordingLibrary({ catalog, versions, legacy, refresh, refreshLegacy, seed }: Props) {
  const [category, setCategory] = useState<CategoryCode>(() => seed?.category ?? "LEA");
  const [subtype, setSubtype] = useState(() => seed?.subtype ?? "Initial Founder");
  const [name, setName] = useState("");
  const [content, setContent] = useState<WordingContent>(() => seed ? wordingFrom(seed.wording) : blankWording());
  const [left, setLeft] = useState(""); const [right, setRight] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const group = CREDENTIAL_CATEGORIES.find(item => item.code === category)!;
  const matching = versions.filter(item => item.category === category && item.subtype === subtype);
  const comparable = [
    ...matching.map(item => ({id:item.id, template_name:item.template_name,version:item.version,status:item.status,text_content:wordingFrom(item.text_content)})),
    ...legacy.filter(item => item.category === category && item.subtype === subtype).map(item => ({id:item.id,template_name:"Existing version",version:item.version,status:item.active?"active":"inactive",text_content:wordingFrom(item.text_content)})),
  ];
  const selectedLeft = comparable.find(item => item.id === left), selectedRight = comparable.find(item => item.id === right);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await fn(); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save wording."); }
    finally { setBusy(false); }
  }
  function importCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    void run(async () => {
      if (file.size > 120000) throw new Error("Choose the original v0.3 wording library JSON.");
      const contents = JSON.parse(await file.text()) as unknown;
      const { data, error } = await requireSupabaseBrowserClient().rpc("import_credential_handoff_catalog", { p_catalog: contents });
      if (error) throw new Error(error.message);
      setMessage(data === true ? "Imported 46 Draft templates and 25 archived references." : "This version was already imported.");
    });
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { error } = await requireSupabaseBrowserClient().rpc("create_credential_wording_version", { p_category: category, p_subtype: subtype, p_template_name: name, p_text_content: content });
      if (error) throw new Error(error.message);
      setMessage("Draft wording saved. It is not approved.");
    });
  }
  function status(id: string, value: "approved" | "archived") {
    if (value === "approved" && !window.confirm("Approve this exact wording version for use after verifying the claims and intended recipients?")) return;
    void run(async () => {
      const { error } = await requireSupabaseBrowserClient().rpc("set_credential_wording_status", { p_id: id, p_status: value });
      if (error) throw new Error(error.message);
    });
  }
  function toggleLegacy(item: LegacyTemplate) {
    void run(async () => {
      const { error } = await requireSupabaseBrowserClient().rpc("set_credential_template_active", { p_template_id: item.id, p_active: !item.active });
      if (error) throw new Error(error.message);
      await refreshLegacy();
    });
  }
  return <section className="mt-7 space-y-6">
    <div><h2 className="text-2xl font-bold">Official Wording Library</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">These categories reserve a structure only; they do not establish awards. New versions are drafts until explicitly approved.</p></div>
    {!catalog.imported && <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <h3 className="font-bold">Import v0.3 wording library</h3>
      <p className="my-2 text-sm">Select the wording library JSON from the handoff package.</p>
      <input aria-label="Import v0.3 wording library JSON" type="file" accept=".json,application/json" disabled={busy} onChange={importCatalog} />
    </section>}
    {message && <p role="status" className="rounded-lg border border-[var(--line)] p-3 text-sm">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={create} className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h3 className="text-lg font-bold">Create a draft version</h3>
        <label className="block text-sm font-semibold">Category<select className={input} value={category} onChange={e => { const next = e.target.value as CategoryCode; setCategory(next); setSubtype(CREDENTIAL_CATEGORIES.find(item => item.code === next)!.subtypes[0]); }}>
          {CREDENTIAL_CATEGORIES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select></label>
        {(group.subtypes.length > 1 || group.subtypes[0] !== subtype) && <label className="block text-sm font-semibold">Subtype<select className={input} value={subtype} onChange={e => setSubtype(e.target.value)}>{group.subtypes.map(item => <option key={item}>{item}</option>)}{!group.subtypes.some(item => item === subtype) && <option>{subtype}</option>}</select></label>}
        <label className="block text-sm font-semibold">Template name<input className={input} required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        {WORDING_FIELDS.map(item => <label key={item.key} className="block text-sm font-semibold">{item.label}{item.multiline ? <textarea aria-label={item.label} className={input} maxLength={4000} placeholder={item.placeholder} value={content[item.key]} onChange={e => setContent(old => ({ ...old, [item.key]: e.target.value }))} /> : <input aria-label={item.label} className={input} maxLength={4000} placeholder={item.placeholder} value={content[item.key]} onChange={e => setContent(old => ({ ...old, [item.key]: e.target.value }))} />}</label>)}
        <button className={button} disabled={busy}>Save draft version</button>
      </form>
      <div className="space-y-5">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h3 className="text-lg font-bold">Versions · {subtype}</h3>
          {matching.length === 0 && <p className="mt-3 text-sm text-[var(--ink-muted)]">Official wording not configured.</p>}
          {matching.map(item => <div key={item.id} className="border-t border-[var(--line)] py-3 text-sm"><p className="font-semibold">{item.template_name} · v{item.version} · {item.status.toUpperCase()}</p><p className="mt-1 text-[var(--ink-muted)]">{item.text_content.title || "[Certificate Title]"}</p><div className="mt-2 flex gap-2">{(item.status === "draft" || item.status === "reviewed") && <button type="button" className={button} disabled={busy} onClick={() => status(item.id,"approved")}>Approve</button>}{item.status !== "archived" && <button type="button" className="rounded-lg border border-[var(--line)] px-3 py-2" disabled={busy} onClick={() => status(item.id,"archived")}>Archive</button>}<button type="button" className="rounded-lg border border-[var(--line)] px-3 py-2" onClick={() => { setName(item.template_name); setContent(wordingFrom(item.text_content)); }}>Use as new draft</button></div></div>)}
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h3 className="text-lg font-bold">Compare versions</h3><div className="grid gap-3 sm:grid-cols-2">{[[left,setLeft],[right,setRight]].map(([value,setter],index) => <select aria-label={index ? "Compare with" : "Compare version"} key={index} className={input} value={value as string} onChange={e => (setter as (value: string) => void)(e.target.value)}><option value="">Choose version</option>{comparable.map(item => <option key={item.id} value={item.id}>{item.template_name} · v{item.version} · {item.status}</option>)}</select>)}</div>
          {selectedLeft && selectedRight && <div className="mt-4 space-y-3">{WORDING_FIELDS.map(field => <div key={field.key}><p className="text-xs font-bold uppercase tracking-wide">{field.label}</p><div className="mt-1 grid gap-2 text-sm sm:grid-cols-2"><p className="whitespace-pre-wrap rounded bg-[var(--canvas)] p-2">{selectedLeft.text_content[field.key] || "—"}</p><p className="whitespace-pre-wrap rounded bg-[var(--canvas)] p-2">{selectedRight.text_content[field.key] || "—"}</p></div></div>)}</div>}
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h3 className="text-lg font-bold">Existing template versions</h3><p className="mt-2 text-sm text-[var(--ink-muted)]">Legacy active status is preserved; it does not assert V2 wording approval.</p>{legacy.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] py-3 text-sm"><span>{item.category} · {item.subtype} · v{item.version} · {item.active ? "active" : "inactive"}</span><button type="button" className={button} disabled={busy} onClick={() => toggleLegacy(item)}>{item.active ? "Deactivate" : "Activate"}</button></div>)}</section>
      </div>
    </div>
    <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><summary className="cursor-pointer text-lg font-bold">Archived reference wordings · {catalog.archive.length}</summary><p className="mt-2 text-sm text-[var(--ink-muted)]">Historical reference only; not available for issuance.</p>{catalog.archive.map(item => <div key={item.legacy_id} className="border-t border-[var(--line)] py-3 text-sm"><strong>{item.legacy_id} · {item.subtype}</strong><p className="mt-1 whitespace-pre-wrap">{item.statement}</p></div>)}</details>
  </section>;
}
