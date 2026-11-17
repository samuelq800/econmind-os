"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CredentialSignatureSelect } from "./credential-signature-select";
import { CREDENTIAL_SIGNATURES, type CredentialSignatureKey } from "@/lib/credentials/signatures";
import { parseCredentialCsv, recipientsFromRows, type ImportedRecipient } from "@/lib/credentials/import";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import { watchCredentialResearchSources, type CredentialResearchSource } from "@/lib/supabase/credential-research-sources";
import { certificatePrintHtml, printLayoutProblems, type RenderBatch, type VisualAssets } from "@/lib/credentials/browser-print";

type Template = { id: string; category: string; subtype: string; version: number; active: boolean };
type Batch = { id: string; template_id: string; status: string; issue_date: string; issuing_authority: string; signature_key: string; preview_verified_at: string | null; entries: ImportedRecipient[] };
type Credential = { id: string; batch_id: string; template_id: string; replaces_id: string | null; certificate_number: string; recipient_name: string; status: string; signature_key: string; created_at: string; recipient_snapshot: Record<string, unknown> };
type Snapshot = { counts: { issued: number; issued_this_month: number; revoked: number }; pending: number; templates: Template[]; batches: Batch[]; credentials: Credential[] };
type OrganizationSource = { id: string; name: string; title: string; organizational_group: string; public_visible: boolean };
type AuditEvent = { id: number; actor: string; action: string; batch_id: string | null; credential_id: string | null; created_at: string; details: Record<string, unknown> };
const field = "mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2.5 text-sm text-[var(--ink)]";
const button = "rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--canvas)] disabled:opacity-50";

export function CredentialAdmin() {
  const { user, loading, configured, openAuth } = useAuth();
  if (!configured) return <main className="p-10">Platform connection is unavailable.</main>;
  if (loading) return <main className="p-10">Checking access…</main>;
  if (!user) return <main className="p-10"><p>Sign in to access credential management.</p><button className={button} onClick={() => openAuth("sign-in")}>Sign in</button></main>;
  return <CredentialWorkspace key={user.id} />;
}

function CredentialWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState("");
  const [signature, setSignature] = useState<CredentialSignatureKey>("samuel_qian_v1");
  const [names, setNames] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [contribution, setContribution] = useState("");
  const [project, setProject] = useState("");
  const [period, setPeriod] = useState("");
  const [imported, setImported] = useState<ImportedRecipient[]>([]);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [issueDate, setIssueDate] = useState("");
  const [authority, setAuthority] = useState("EconMind Founder Team");
  const [category, setCategory] = useState("CON");
  const [subtype, setSubtype] = useState("");
  const [title, setTitle] = useState("");
  const [templateStatement, setTemplateStatement] = useState("");
  const [templateRole, setTemplateRole] = useState("");
  const [templateContribution, setTemplateContribution] = useState("");
  const [templatePeriod, setTemplatePeriod] = useState("");
  const [research, setResearch] = useState<CredentialResearchSource[]>([]);
  const [organization, setOrganization] = useState<OrganizationSource[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [moreAudit, setMoreAudit] = useState(false);
  const [preview, setPreview] = useState<{ html: string; title: string; batchId: string; index: number | null; credentialId: string | null } | null>(null);
  const [previewProblem, setPreviewProblem] = useState("");
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [previewIndex, setPreviewIndex] = useState<Record<string, number>>({});
  const [previewedEntries, setPreviewedEntries] = useState<Record<string, number[]>>({});
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [results, setResults] = useState<Credential[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef<string | null>(null);
  const visualAssets = useRef<Promise<VisualAssets> | null>(null);
  const auditExpanded = useRef(false);

  const loadSnapshot = useCallback(async () => {
    const { data, error: failure } = await requireSupabaseBrowserClient().rpc("list_credential_admin_data");
    if (failure) throw failure;
    return data as Snapshot;
  }, []);
  useEffect(() => {
    let active = true;
    void loadSnapshot().then(data => { if (active) setSnapshot(data); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Superme administrator access required."); });
    return () => { active = false; };
  }, [loadSnapshot]);
  useEffect(() => {
    if (!snapshot) return;
    const client = requireSupabaseBrowserClient();
    let active = true;
    let organizationGeneration = 0;
    const loadOrganization = async () => {
      const generation = ++organizationGeneration;
      try {
        const all: OrganizationSource[] = [];
        let cursor: string | null = null;
        for (;;) {
          const { data, error: failure } = await client.rpc("list_credential_organization_page", { p_after_id: cursor, p_limit: 100 });
          if (failure) throw failure;
          if (!Array.isArray(data)) throw new Error("Invalid organization source response.");
          const page = data as OrganizationSource[];
          for (const person of page) {
            if (!person.id || (cursor !== null && person.id <= cursor)) throw new Error("Invalid organization pagination order.");
            all.push(person); cursor = person.id;
          }
          if (page.length < 100) break;
        }
        if (active && generation === organizationGeneration) setOrganization(all);
      } catch {
        if (active && generation === organizationGeneration) { setOrganization([]); setError("Organization sources could not be loaded."); }
      }
    };
    const loadAudit = async () => {
      if (auditExpanded.current) return;
      const { data, error: failure } = await client.rpc("list_credential_audit_logs");
      if (active && !failure && Array.isArray(data)) { setAudit(data as AuditEvent[]); setMoreAudit(data.length === 100); }
    };
    const loadBatchState = async () => {
      try { const current = await loadSnapshot(); if (active) setSnapshot(current); }
      catch { if (active) { setSnapshot(null); setResearch([]); setOrganization([]); setAudit([]); setPreview(null); setError("Administrator access could not be verified. Reload to try again."); } }
    };
    let running = false;
    let queued = false;
    const refreshManagement = async () => {
      if (!active) return;
      if (running) { queued = true; return; }
      running = true;
      try { await Promise.allSettled([loadAudit(), loadBatchState()]); }
      finally { running = false; if (queued && active) { queued = false; void refreshManagement(); } }
    };
    const channel = client.channel("credential-organization-sources")
      .on("postgres_changes", { event: "*", schema: "public", table: "organization_directory" }, () => { void loadOrganization(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "credential_source_revisions", filter: "source=eq.jobs" }, () => { void refreshManagement(); })
      .subscribe(status => { if (status === "SUBSCRIBED") void refreshManagement(); });
    const stopResearch = watchCredentialResearchSources(setResearch, cause => setError(cause.message));
    void loadOrganization();
    void refreshManagement();
    const visible = () => { if (document.visibilityState === "visible") { void loadOrganization(); void refreshManagement(); } };
    const timer = window.setInterval(visible, 15000);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; stopResearch(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); void client.removeChannel(channel); };
  }, [Boolean(snapshot)]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); setSnapshot(await loadSnapshot()); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
      try { setSnapshot(await loadSnapshot()); } catch { setSnapshot(null); }
    }
    finally { setBusy(false); }
  }
  function addSource(entry: ImportedRecipient) { setImported(previous => [...previous, entry]); setAllowDuplicates(false); }
  function addResearchSources(papers: CredentialResearchSource[]) {
    const candidates = papers.filter(paper => paper.author_display_name?.trim());
    const unchecked = candidates.filter(paper => paper.owner_name_matches !== true).length;
    if (unchecked && !window.confirm(`${unchecked} article(s) have an author name that differs from the linked account or cannot be compared. Verify those identities before linking the accounts. Continue?`)) return;
    setImported(previous => [...previous, ...candidates.map(paper => ({ name: paper.author_display_name, role: "", department: "", project: paper.title, contribution: "", service_period: "", user_id: paper.uploader_user_id }))]);
    setAllowDuplicates(false);
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("The file must be 5 MB or less.");
      let rows;
      if (file.name.toLowerCase().endsWith(".csv")) rows = parseCredentialCsv(await file.text());
      else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        rows = await readSheet(file);
      } else throw new Error("Choose a CSV or XLSX file.");
      setImported(recipientsFromRows(rows)); setError(""); setAllowDuplicates(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The file could not be imported."); }
  }
  function changeImported(index: number, key: keyof ImportedRecipient, value: string) {
    setImported(old => old.map((entry, i) => {
      if (i !== index) return entry;
      const updated = { ...entry, [key]: value };
      if (key === "name" && value !== entry.name) delete updated.user_id;
      return updated;
    }));
  }
  function unlinkRecipient(index: number) {
    setImported(old => old.map((entry, i) => {
      if (i !== index) return entry;
      const updated = { ...entry };
      delete updated.user_id;
      return updated;
    }));
  }
  const manualNames = names.split("\n").map(name => name.trim()).filter(Boolean);
  const allNames = [...manualNames, ...imported.map(entry => entry.name.trim())];
  const duplicated = new Set(allNames.map(name => name.toLocaleLowerCase())).size !== allNames.length;
  function createDraft(event: FormEvent) {
    event.preventDefault();
    const entries = [...manualNames.map(name => ({ name, role, department, project, contribution, service_period: period })), ...imported];
    if (!entries.length || entries.length > 500 || entries.some(entry => !entry.name.trim())) { setError("Provide between 1 and 500 named recipients."); return; }
    if (duplicated && !allowDuplicates) { setError("Review the duplicate names before continuing."); return; }
    if (!request.current) request.current = crypto.randomUUID();
    void action(async () => {
      const { error: failure } = await requireSupabaseBrowserClient().rpc("create_credential_draft", { p_request_key: request.current, p_template_id: template, p_issue_date: issueDate, p_issuing_authority: authority, p_entries: entries, p_signature_key: signature });
      if (failure) throw failure;
      request.current = null; setNames(""); setImported([]); setAllowDuplicates(false);
    });
  }
  function createTemplate(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      const { error: failure } = await requireSupabaseBrowserClient().rpc("create_credential_template", { p_category: category, p_subtype: subtype, p_text_content: { title, certification_statement: templateStatement, role_description: templateRole, contribution_paragraph: templateContribution, service_period_text: templatePeriod } });
      if (failure) throw failure;
      setSubtype(""); setTitle(""); setTemplateStatement(""); setTemplateRole(""); setTemplateContribution(""); setTemplatePeriod("");
    });
  }
  function createStarterTemplates() {
    void action(async () => {
      const { error: failure } = await requireSupabaseBrowserClient().rpc("ensure_credential_starter_templates");
      if (failure) throw failure;
    });
  }
  function toggleTemplate(item: Template) {
    void action(async () => {
      const { error: failure } = await requireSupabaseBrowserClient().rpc("set_credential_template_active", { p_template_id: item.id, p_active: !item.active });
      if (failure) throw failure;
    });
  }
  async function openCertificate(batchId: string, index: number | null, credentialId?: string) {
    const client = requireSupabaseBrowserClient();
    if (!visualAssets.current) visualAssets.current = (async () => {
      const { data, error: failure } = await client.rpc("get_credential_visual_assets");
      if (failure) throw failure;
      return data as VisualAssets;
    })().catch(cause => { visualAssets.current = null; throw cause; });
    const [assets, batchResult] = await Promise.all([
      visualAssets.current,
      client.rpc("get_credential_render_data", { p_batch_id: batchId, p_credential_id: credentialId || null }),
    ]);
    if (batchResult.error) throw batchResult.error;
    const batch = batchResult.data as RenderBatch & { status: string; entries: ImportedRecipient[]; credentials: { id: string; status: string; recipient_snapshot: ImportedRecipient; certificate_number: string }[] };
    const credential = credentialId ? batch.credentials.find(row => row.id === credentialId && row.status === "issued") : null;
    if (credentialId && (!credential || batch.status !== "issued")) throw new Error("The issued certificate is no longer available.");
    const entry = credential ? credential.recipient_snapshot : batch.entries[index ?? -1];
    if (!entry) throw new Error("Recipient not found.");
    const html = await certificatePrintHtml(assets, batch, entry, credential?.certificate_number || null);
    setPreviewProblem("Loading preview…");
    setPreview({ html, title: credential ? `${entry.name} · ${credential.certificate_number}` : entry.name, batchId, index, credentialId: credential?.id ?? null });
  }
  function previewBatch(batch: Batch) {
    const index = previewIndex[batch.id] ?? 0;
    void action(async () => { await openCertificate(batch.id, index); });
  }
  function batchOperation(batch: Batch, operation: "review" | "verify" | "issue") {
    if (operation === "verify" && !window.confirm("I have personally reviewed every certificate preview for this batch, including the text, signature, and print layout.")) return;
    if (operation === "issue" && !window.confirm(`Issue ${batch.entries.length} official certificate(s) with ${batch.signature_key}? This assigns permanent certificate numbers.`)) return;
    void action(async () => {
      const client = requireSupabaseBrowserClient();
      if (operation === "verify") {
        const { error: failure } = await client.rpc("confirm_credential_print_review", { p_batch_id: batch.id, p_confirm: true });
        if (failure) throw failure;
        return;
      }
      if (operation === "review") {
        const first = await client.rpc("review_credential_draft", { p_batch_id: batch.id, p_acknowledge_duplicates: false });
        if (first.error?.code === "23505") {
          if (!window.confirm("Potential duplicate names exist. Check identities and previous certificates before continuing.")) return;
          const retry = await client.rpc("review_credential_draft", { p_batch_id: batch.id, p_acknowledge_duplicates: true });
          if (retry.error) throw retry.error;
        } else if (first.error) throw first.error;
        return;
      }
      const { error: failure } = await client.rpc("issue_credential_batch", { p_batch_id: batch.id });
      if (failure) throw failure;
    });
  }
  function viewCredential(item: Credential) {
    void action(async () => { await openCertificate(item.batch_id, null, item.id); });
  }
  function printCredential() {
    const current = preview;
    if (!current?.credentialId || previewProblem) return;
    void action(async () => {
      const { data, error: failure } = await requireSupabaseBrowserClient().rpc("get_credential_render_data", { p_batch_id: current.batchId, p_credential_id: current.credentialId });
      if (failure) { setPreview(null); throw failure; }
      const records = (data as { credentials?: { id: string; status: string }[] }).credentials ?? [];
      if (!records.some(item => item.id === current.credentialId && item.status === "issued")) { setPreview(null); throw new Error("This credential is no longer available for printing."); }
      previewFrame.current?.contentWindow?.focus();
      previewFrame.current?.contentWindow?.print();
    });
  }
  function previewLoaded() {
    const frame = previewFrame.current, current = preview;
    if (!frame?.contentDocument || !current) return;
    void (async () => {
      const doc = frame.contentDocument!;
      try {
        await doc.fonts.ready;
        await Promise.all([...doc.images].map(image => image.decode()));
        if (previewFrame.current !== frame || frame.contentDocument !== doc) return;
        const problems = printLayoutProblems(doc);
        if (problems.length) { setPreviewProblem(`Text exceeds the approved certificate layout: ${problems.join(", ")}`); return; }
        setPreviewProblem("");
        if (current.index !== null) setPreviewedEntries(old => ({ ...old, [current.batchId]: [...new Set([...(old[current.batchId] ?? []), current.index!])] }));
      } catch {
        if (previewFrame.current === frame && frame.contentDocument === doc) setPreviewProblem("The certificate images could not be loaded. Reload the preview before continuing.");
      }
    })();
  }
  function prepareCorrection(item: Credential) {
    const original = snapshot?.templates.find(value => value.id === item.template_id);
    const current = snapshot?.templates.find(value => value.active && value.category === original?.category && value.subtype === original?.subtype);
    if (!current) { setError("An active template is required to prepare this correction."); return; }
    const source = item.recipient_snapshot ?? {};
    const text = (key: string) => typeof source[key] === "string" ? source[key] as string : "";
    setNames(""); setImported([{ name: item.recipient_name, role: text("role"), department: text("department"), project: text("project"), contribution: text("contribution"), service_period: text("service_period"), replaces_id: item.id, ...(text("user_id") ? { user_id: text("user_id") } : {}) }]);
    setTemplate(current.id);
    const signer = CREDENTIAL_SIGNATURES.find(value => value.key === item.signature_key);
    if (signer) setSignature(signer.key);
    setIssueDate(""); setAllowDuplicates(false);
    document.getElementById("credential-draft")?.scrollIntoView({ behavior: "smooth" });
  }
  function reviseDraft(batch: Batch) {
    const original = snapshot?.templates.find(value => value.id === batch.template_id);
    const current = snapshot?.templates.find(value => value.active && value.category === original?.category && value.subtype === original?.subtype);
    if (!current) { setError("An active template is required to revise this draft."); return; }
    setNames("");
    setImported(batch.entries.map(entry => ({ name: entry.name || "", role: entry.role || "", department: entry.department || "", project: entry.project || "", contribution: entry.contribution || "", service_period: entry.service_period || "", ...(entry.replaces_id ? { replaces_id: entry.replaces_id } : {}), ...(entry.user_id ? { user_id: entry.user_id } : {}) })));
    setTemplate(current.id); setIssueDate(batch.issue_date); setAuthority(batch.issuing_authority); setAllowDuplicates(false); request.current = null;
    const signer = CREDENTIAL_SIGNATURES.find(value => value.key === batch.signature_key);
    if (signer) setSignature(signer.key);
    document.getElementById("credential-draft")?.scrollIntoView({ behavior: "smooth" });
  }
  function cancelDraft(batch: Batch) {
    if (!window.confirm("Cancel this unissued draft and any verification in progress?")) return;
    void action(async () => {
      const { error: failure } = await requireSupabaseBrowserClient().rpc("cancel_credential_draft", { p_batch_id: batch.id });
      if (failure) throw failure;
    });
  }
  function revoke(item: Credential) {
    const reason = window.prompt(`Reason for revoking ${item.certificate_number}:`)?.trim();
    if (!reason || !window.confirm(`Revoke ${item.certificate_number}? The number will never be reused.`)) return;
    void action(async () => {
      const { error: failure } = await requireSupabaseBrowserClient().rpc("revoke_credential", { p_credential_id: item.id, p_reason: reason });
      if (failure) throw failure; setResults(null); setPreview(null);
    });
  }
  function searchRecords(more = false) {
    void action(async () => {
      const cursor = more ? results?.at(-1) : undefined;
      const { data, error: failure } = await requireSupabaseBrowserClient().rpc("search_credential_records", {
        p_query: search, p_category: filterCategory || null, p_department: filterDepartment,
        p_from: filterFrom || null, p_to: filterTo || null,
        p_before: cursor?.created_at || null, p_before_id: cursor?.id || null, p_limit: 50,
      });
      if (failure) throw failure;
      if (!Array.isArray(data)) throw new Error("Credential search returned an invalid response.");
      setResults(previous => more ? [...(previous ?? []), ...data as Credential[]] : data as Credential[]);
      setHasMore(data.length === 50);
    });
  }
  function loadMoreAudit() {
    const last = audit.at(-1);
    if (!last) return;
    void action(async () => {
      auditExpanded.current = true;
      const { data, error: failure } = await requireSupabaseBrowserClient().rpc("list_credential_audit_logs", { p_limit: 100, p_before_id: last.id });
      if (failure) throw failure;
      if (!Array.isArray(data)) throw new Error("Audit history response is invalid.");
      setAudit(old => [...old, ...data as AuditEvent[]]); setMoreAudit(data.length === 100);
    });
  }

  if (!snapshot) return <main className="mx-auto max-w-3xl p-10"><h1 className="text-3xl font-bold">Credential management</h1><p className="mt-5">{error || "Checking administrator access…"}</p></main>;
  return <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
    <header><p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Superme administration</p><h1 className="mt-3 text-4xl font-bold">Credential management</h1><p className="mt-3 text-[var(--ink-muted)]">Draft and review official EconMind League credentials.</p></header>
    {error && <p role="alert" className="mt-6 rounded-lg border border-[var(--red)] p-4 text-[var(--red)]">{error}</p>}
    <section className="mt-8 grid gap-3 sm:grid-cols-4">{[["Issued",snapshot.counts.issued],["Issued this month",snapshot.counts.issued_this_month],["Drafts / reviewed",snapshot.pending],["Revoked",snapshot.counts.revoked]].map(([label,value]) => <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--ink-muted)]">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <form id="credential-draft" onSubmit={createDraft} className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Create a draft</h2>
        <label className="block text-sm font-semibold">Template *<select required className={field} value={template} onChange={e => setTemplate(e.target.value)}><option value="">Choose a template</option>{snapshot.templates.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.category} · {t.subtype} · v{t.version}</option>)}</select></label>
        <label className="block text-sm font-semibold">Recipients, one name per line {imported.length === 0 && "*"}<textarea required={imported.length === 0} className={field} rows={4} value={names} onChange={e => { setNames(e.target.value); setAllowDuplicates(false); }} /></label>
        <label className="block text-sm font-semibold">Import recipients (CSV or XLSX)<input className={field} type="file" accept=".csv,.xlsx" onChange={event => { void importFile(event); }} /></label>
        {imported.length > 0 && <div className="space-y-4"><p className="text-sm font-semibold">Imported recipients · {imported.length}</p>{imported.map((entry, index) => <div key={index} className="grid gap-2 rounded-lg border border-[var(--line)] p-3 sm:grid-cols-2">{entry.replaces_id && <p className="text-xs font-semibold sm:col-span-2">Correction of a revoked credential</p>}{entry.user_id && <p className="text-xs font-semibold sm:col-span-2">Linked to article account · editing the name removes the link <button type="button" className="underline" onClick={() => unlinkRecipient(index)}>Unlink</button></p>}{(["name","role","department","project","contribution","service_period"] as const).map(key => <label key={key} className="text-xs font-semibold">{key.replaceAll("_", " ")}<input className={field} value={entry[key]} onChange={event => { changeImported(index, key, event.target.value); setAllowDuplicates(false); }} /></label>)}<button type="button" className="text-left text-sm text-[var(--red)]" onClick={() => setImported(old => old.filter((_, i) => i !== index))}>Remove recipient</button></div>)}</div>}
        {duplicated && <label className="block text-sm text-[var(--red)]"><input type="checkbox" checked={allowDuplicates} onChange={e => setAllowDuplicates(e.target.checked)} /> Duplicate names detected; I have checked they represent the intended recipients.</label>}
        <label className="block text-sm font-semibold">Role / position<input className={field} value={role} onChange={e => setRole(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Department / project<input className={field} value={department} onChange={e => setDepartment(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Project<input className={field} value={project} onChange={e => setProject(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Contribution<textarea className={field} value={contribution} onChange={e => setContribution(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Service period<input className={field} value={period} onChange={e => setPeriod(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Issue date *<input required type="date" className={field} value={issueDate} onChange={e => setIssueDate(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Issuing authority *<select className={field} value={authority} onChange={e => setAuthority(e.target.value)}><option>EconMind Founder Team</option><option>EconMind Leadership Group</option></select></label>
        <CredentialSignatureSelect value={signature} onChange={setSignature} />
        <p className="text-sm text-[var(--ink-muted)]">A draft does not allocate a certificate number. Review every preview and the browser print layout before issuance.</p><button disabled={busy} className={button}>Save draft</button>
      </form>
      <div className="space-y-6"><form onSubmit={createTemplate} className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Text template</h2>{snapshot.templates.length === 0 && <button type="button" disabled={busy} className={button} onClick={createStarterTemplates}>Add standard templates</button>}<label className="block text-sm font-semibold">Category *<select className={field} value={category} onChange={e => setCategory(e.target.value)}>{["MEM","PAR","CON","LEA","DIS"].map(code => <option key={code}>{code}</option>)}</select></label><label className="block text-sm font-semibold">Subtype *<input required className={field} value={subtype} onChange={e => setSubtype(e.target.value)} /></label><label className="block text-sm font-semibold">Certificate title *<input required className={field} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="block text-sm font-semibold">Certification statement<textarea className={field} value={templateStatement} onChange={e => setTemplateStatement(e.target.value)} /></label><label className="block text-sm font-semibold">Default role description<input className={field} value={templateRole} onChange={e => setTemplateRole(e.target.value)} /></label><label className="block text-sm font-semibold">Default contribution paragraph<textarea className={field} value={templateContribution} onChange={e => setTemplateContribution(e.target.value)} /></label><label className="block text-sm font-semibold">Default service period text<input className={field} value={templatePeriod} onChange={e => setTemplatePeriod(e.target.value)} /></label><button disabled={busy} className={button}>Create template version</button><div className="space-y-2 border-t border-[var(--line)] pt-4"><p className="text-sm font-semibold">Template versions</p>{snapshot.templates.map(item => <div className="flex flex-wrap items-center justify-between gap-2 text-sm" key={item.id}><span>{item.category} · {item.subtype} · v{item.version} · {item.active ? "active" : "inactive"}</span><button type="button" disabled={busy} className={button} onClick={() => toggleTemplate(item)}>{item.active ? "Deactivate" : "Activate"}</button></div>)}</div></form>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Organization sources</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Select an appointment to add its displayed name, role and group. Verify identity and contribution before issuing.</p><button type="button" disabled={busy || organization.length === 0} className={button + " mt-3"} onClick={() => { setImported(old => [...old, ...organization.map(person => ({ name: person.name, role: person.title, department: person.organizational_group, project: "", contribution: "", service_period: "" }))]); setAllowDuplicates(false); }}>Add all organization entries</button>{organization.length === 0 && <p className="mt-3 text-sm text-[var(--ink-muted)]">No shared organization records are available.</p>}<div className="mt-3 max-h-60 overflow-auto">{organization.map(person => <button type="button" key={person.id} onClick={() => addSource({ name: person.name, role: person.title, department: person.organizational_group, project: "", contribution: "", service_period: "" })} className="block w-full border-b border-[var(--line)] py-2 text-left text-sm">{person.name} · {person.title} · {person.organizational_group}</button>)}</div></section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Research sources</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Author names are shown as submitted and linked to the article account. Review any name mismatch; coauthor text is not automatically linked.</p><button type="button" disabled={busy || research.length === 0} className={button + " mt-3"} onClick={() => addResearchSources(research)}>Add all research author entries</button><div className="mt-3 max-h-60 overflow-auto">{research.map(paper => <button type="button" key={paper.paper_id} onClick={() => addResearchSources([paper])} className="block w-full border-b border-[var(--line)] py-2 text-left text-sm">{paper.author_display_name} · {paper.title} · {paper.status}</button>)}</div></section>
      </div>
    </div>
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Recent batches</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Preview each certificate, confirm a manual layout review, then issue. Use the browser print dialog to print or save as PDF.</p>{snapshot.batches.map(batch => <div className="border-t border-[var(--line)] py-3 text-sm" key={batch.id}><p>{batch.issue_date} · {batch.entries.length} recipients · {batch.status} · {batch.signature_key}</p><div className="mt-3 flex flex-wrap gap-2"><select className={field + " !mt-0 !w-auto"} value={previewIndex[batch.id] ?? 0} onChange={e => setPreviewIndex(old => ({ ...old, [batch.id]: Number(e.target.value) }))}>{batch.entries.map((entry, index) => <option key={index} value={index}>{entry.name}</option>)}</select><button type="button" disabled={busy} className={button} onClick={() => previewBatch(batch)}>Preview</button>{["draft","reviewed"].includes(batch.status) && <><button type="button" disabled={busy} className={button} onClick={() => reviseDraft(batch)}>Revise as new draft</button><button type="button" disabled={busy} className={button} onClick={() => cancelDraft(batch)}>Cancel draft</button></>}{batch.status === "draft" && <button type="button" disabled={busy || (previewedEntries[batch.id]?.length ?? 0) !== batch.entries.length} className={button} onClick={() => batchOperation(batch, "review")}>Mark reviewed</button>}{batch.status === "reviewed" && !batch.preview_verified_at && <button type="button" disabled={busy || (previewedEntries[batch.id]?.length ?? 0) !== batch.entries.length} className={button} onClick={() => batchOperation(batch, "verify")}>Confirm manual layout review</button>}{batch.status === "reviewed" && batch.preview_verified_at && <button type="button" disabled={busy} className={button} onClick={() => batchOperation(batch, "issue")}>Issue certificates</button>}</div></div>)}</section>
    {preview && <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Preview · {preview.title}</h2><div className="flex gap-2">{preview.credentialId && <button type="button" disabled={busy || Boolean(previewProblem)} className={button} onClick={printCredential}>Print / Save PDF</button>}<button type="button" onClick={() => setPreview(null)}>Close</button></div></div><p className="mt-3 text-sm text-[var(--ink-muted)]">Before issuing or printing, check the preview and your browser print dialog. Choose A4 landscape and enable background graphics.</p>{previewProblem && <p role="alert" className="mt-3 text-[var(--red)]">{previewProblem}</p>}<div className="mt-4 overflow-auto"><iframe ref={previewFrame} title="Certificate preview" sandbox="allow-same-origin allow-modals" className="border-0 bg-white" style={{ width: 1123, height: 794 }} srcDoc={preview.html} onLoad={previewLoaded} /></div></section>}
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Issued records</h2><form className="my-4 grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); searchRecords(); }}><label className="text-sm">Name or number<input className={field} value={search} onChange={e => { setSearch(e.target.value); setResults(null); }} /></label><label className="text-sm">Category<select className={field} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setResults(null); }}><option value="">All</option>{["MEM","PAR","CON","LEA","DIS"].map(code => <option key={code}>{code}</option>)}</select></label><label className="text-sm">Department<input className={field} value={filterDepartment} onChange={e => { setFilterDepartment(e.target.value); setResults(null); }} /></label><label className="text-sm">From<input type="date" className={field} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setResults(null); }} /></label><label className="text-sm">To<input type="date" className={field} value={filterTo} onChange={e => { setFilterTo(e.target.value); setResults(null); }} /></label><div className="flex items-end"><button className={button} disabled={busy}>Search all records</button></div></form>{results === null && <p className="text-sm text-[var(--ink-muted)]">Showing recent records. Search to query the full history.</p>}{(results ?? snapshot.credentials).map(item => <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-3 text-sm" key={item.id}><span>{item.certificate_number} · {item.recipient_name} · {item.status} · {item.signature_key}</span><div className="flex gap-2"><button type="button" disabled={busy || item.status !== "issued"} className={button} onClick={() => viewCredential(item)}>View / Print</button><button type="button" disabled={busy || item.status !== "issued"} className={button} onClick={() => revoke(item)}>Revoke</button>{item.status === "revoked" && <button type="button" disabled={busy} className={button} onClick={() => prepareCorrection(item)}>Correct</button>}</div></div>)}{results && results.length === 0 && <p className="py-3 text-sm">No matching records.</p>}{results && hasMore && <button type="button" disabled={busy} onClick={() => searchRecords(true)} className={button}>Load more</button>}</section>
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Audit history</h2>{audit.map(event => <details className="border-t border-[var(--line)] py-3 text-sm" key={event.id}><summary>{event.created_at} · {event.action} · {event.actor}</summary><pre className="mt-3 overflow-auto text-xs">{JSON.stringify({ batch_id: event.batch_id, credential_id: event.credential_id, ...event.details }, null, 2)}</pre></details>)}{moreAudit && <button type="button" disabled={busy} className={button} onClick={loadMoreAudit}>Load older events</button>}</section>
  </main>;
}
