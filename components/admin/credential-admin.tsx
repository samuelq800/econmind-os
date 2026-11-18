"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CredentialVisualEditor } from "./credential-visual-editor";
import { CredentialWordingLibrary, type WordingSeed } from "./credential-wording-library";
import { EMPTY_WORDING_CATALOG, type WordingCatalog, type CategoryCode, type WordingContent, type WordingVersion } from "@/lib/credentials/wording";
import type { CredentialSignatureKey } from "@/lib/credentials/signatures";
import type { ImportedRecipient } from "@/lib/credentials/import";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import { watchCredentialResearchSources, listCredentialResearchSources, type CredentialResearchSource } from "@/lib/supabase/credential-research-sources";
import { certificatePrintHtml, certificateStandalonePrintHtml, printLayoutProblems, type RenderBatch, type VisualAssets } from "@/lib/credentials/browser-print";

type Template = { id: string; category: string; subtype: string; version: number; active: boolean; text_content: Partial<WordingContent> };
type Batch = { id: string; template_id: string; status: string; issue_date: string; issuing_authority: string; signature_key: string; preview_verified_at: string | null; entries: ImportedRecipient[] };
type Credential = { id: string; batch_id: string; template_id: string; replaces_id: string | null; certificate_number: string; recipient_name: string; status: string; signature_key: string; created_at: string; recipient_snapshot: Record<string, unknown> };
type Snapshot = { counts: { issued: number; issued_this_month: number; revoked: number }; pending: number; templates: Template[]; batches: Batch[]; credentials: Credential[] };
type OrganizationSource = { id: string; name: string; title: string; organizational_group: string };
type AuditEvent = { id: number; actor: string; action: string; batch_id: string | null; credential_id: string | null; created_at: string; details: Record<string, unknown> };
type EditorInitial = { id?: string; recipient?: ImportedRecipient; category?: CategoryCode; subtype?: string; wording?: Partial<WordingContent>; source?: {kind?: string;id?: string;label?: string;linked_name?: string}; wordingRef?: {type?: "library"|"legacy";id?: string;modified?: boolean}; signature?: CredentialSignatureKey; authority?: string } | null;
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
  const [tab, setTab] = useState<"dashboard" | "editor" | "bulk" | "wording" | "records" | "audit">("dashboard");
  const [singleVisited, setSingleVisited] = useState(false); const [bulkVisited, setBulkVisited] = useState(false);
  const [singleSession, setSingleSession] = useState(0); const [bulkSession, setBulkSession] = useState(0);
  const [singleInitial, setSingleInitial] = useState<EditorInitial>(null); const [bulkInitial, setBulkInitial] = useState<EditorInitial>(null);
  const [wordingSeed, setWordingSeed] = useState<WordingSeed | null>(null);
  const [catalog, setCatalog] = useState<WordingCatalog>(EMPTY_WORDING_CATALOG);
  const [wordingVersions, setWordingVersions] = useState<WordingVersion[]>([]);
  const [research, setResearch] = useState<CredentialResearchSource[]>([]);
  const [organization, setOrganization] = useState<OrganizationSource[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [moreAudit, setMoreAudit] = useState(false);
  const [preview, setPreview] = useState<{ html: string; title: string; batchId: string; index: number | null; credentialId: string | null; revision: number } | null>(null);
  const [previewProblem, setPreviewProblem] = useState("");
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [previewIndex, setPreviewIndex] = useState<Record<string, number>>({});
  const [previewedEntries, setPreviewedEntries] = useState<Record<string, { revision: number; indexes: number[] }>>({});
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [results, setResults] = useState<Credential[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const visualAssets = useRef<Promise<VisualAssets> | null>(null);
  const auditExpanded = useRef(false);

  const loadVisualAssets = useCallback(() => {
    if (!visualAssets.current) visualAssets.current = (async () => {
      const { data, error: failure } = await requireSupabaseBrowserClient().rpc("get_credential_visual_assets");
      if (failure) throw failure;
      return data as VisualAssets;
    })().catch(cause => { visualAssets.current = null; throw cause; });
    return visualAssets.current;
  }, []);
  const loadSnapshot = useCallback(async () => {
    const { data, error: failure } = await requireSupabaseBrowserClient().rpc("list_credential_admin_data");
    if (failure) throw failure;
    return data as Snapshot;
  }, []);
  const refreshWordings = useCallback(async () => {
    const client = requireSupabaseBrowserClient();
    const [versions, nextCatalog] = await Promise.all([
      client.rpc("list_credential_wording_versions"), client.rpc("get_credential_handoff_catalog"),
    ]);
    if (versions.error) throw versions.error;
    if (nextCatalog.error) throw nextCatalog.error;
    setWordingVersions((versions.data ?? []) as WordingVersion[]);
    setCatalog(nextCatalog.data as WordingCatalog);
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    void Promise.resolve().then(refreshWordings).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Wording library could not be loaded."));
  }, [Boolean(snapshot), refreshWordings]); // eslint-disable-line react-hooks/exhaustive-deps
  const savedEditor = useCallback(async () => { setSnapshot(await loadSnapshot()); setPreviewedEntries({}); }, [loadSnapshot]);
  const clearSingleInitial = useCallback(() => setSingleInitial(null), []);
  const clearBulkInitial = useCallback(() => setBulkInitial(null), []);
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
          const { data, error: failure } = await client.rpc("list_credential_organization_identities", { p_after_id: cursor, p_limit: 100 });
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
      catch { if (active) { visualAssets.current = null; setSnapshot(null); setResearch([]); setOrganization([]); setAudit([]); setPreview(null); setError("Administrator access could not be verified. Reload to try again."); } }
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
  async function openCertificate(batchId: string, index: number | null, credentialId?: string) {
    const client = requireSupabaseBrowserClient();
    const [assets, batchResult] = await Promise.all([
      loadVisualAssets(),
      client.rpc("get_credential_editor_render_data", { p_batch_id: batchId, p_credential_id: credentialId || null }),
    ]);
    if (batchResult.error) throw batchResult.error;
    const batch = batchResult.data as RenderBatch & { status: string; entries: ImportedRecipient[]; editor: { wordings: Record<string, string>[]; revision: number } | null; credentials: { id: string; status: string; recipient_snapshot: ImportedRecipient; certificate_number: string; template_snapshot?: { text_content?: Record<string, string> } }[] };
    const credential = credentialId ? batch.credentials.find(row => row.id === credentialId && row.status === "issued") : null;
    if (credentialId && (!credential || batch.status !== "issued")) throw new Error("The issued certificate is no longer available.");
    const entry = credential ? credential.recipient_snapshot : batch.entries[index ?? -1];
    if (!entry) throw new Error("Recipient not found.");
    const text = credential?.template_snapshot?.text_content ?? (index !== null ? batch.editor?.wordings[index] : null) ?? batch.template;
    const html = await certificatePrintHtml(assets, { ...batch, template: text }, entry, credential?.certificate_number || null);
    setPreviewProblem("Loading preview…");
    setPreview({ html, title: credential ? `${entry.name} · ${credential.certificate_number}` : entry.name, batchId, index, credentialId: credential?.id ?? null, revision: batch.editor?.revision ?? 0 });
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
        const expected = previewedEntries[batch.id]?.revision;
        if (expected === undefined) throw new Error("Preview every recipient before review.");
        const first = await client.rpc("review_credential_editor_draft", { p_batch_id: batch.id, p_expected_revision: expected, p_acknowledge_duplicates: false });
        if (first.error?.code === "23505") {
          if (!window.confirm("Potential duplicate names exist. Check identities and previous certificates before continuing.")) return;
          const retry = await client.rpc("review_credential_editor_draft", { p_batch_id: batch.id, p_expected_revision: expected, p_acknowledge_duplicates: true });
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
  function exportBatch(batchId: string) {
    void action(async () => {
      const configured = process.env.NEXT_PUBLIC_CREDENTIAL_RENDERER_URL;
      if (!configured) throw new Error("The private batch PDF renderer has not been configured.");
      const endpoint = new URL("/batch-zip", configured);
      if (endpoint.protocol !== "https:") throw new Error("The private renderer requires HTTPS.");
      const { data: { session }, error } = await requireSupabaseBrowserClient().auth.getSession();
      if (error || !session) throw new Error("Sign in again before exporting certificates.");
      const response = await fetch(endpoint, {
        method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }), redirect: "error", signal: AbortSignal.timeout(15 * 60 * 1000),
      });
      if (!response.ok || response.headers.get("Content-Type") !== "application/zip") {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || "The batch PDF export failed.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `EconMind_Credentials_${batchId}.zip`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function printCredential() {
    const current = preview;
    if (!current?.credentialId || previewProblem) return;
    // Open during the click: Safari can block a tab opened after an RPC.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Allow pop-ups for this site, then try printing again.");
      return;
    }
    printWindow.opener = null;
    printWindow.document.body.textContent = "Preparing certificate…";

    void action(async () => {
      try {
        const { data, error: failure } = await requireSupabaseBrowserClient().rpc("get_credential_render_data", { p_batch_id: current.batchId, p_credential_id: current.credentialId });
        if (failure) throw new Error(failure.message);
        const records = (data as { credentials?: { id: string; status: string }[] }).credentials ?? [];
        if (!records.some(item => item.id === current.credentialId && item.status === "issued")) {
          setPreview(null);
          throw new Error("This credential is no longer available for printing.");
        }
        if (printWindow.closed) return;
        const doc = printWindow.document;
        doc.open();
        doc.write(certificateStandalonePrintHtml(current.html));
        doc.close();
        await doc.fonts.ready;
        await Promise.all([...doc.images].map(image => image.decode()));
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      } catch (cause) {
        printWindow.close();
        throw cause;
      }
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
        if (current.index !== null) setPreviewedEntries(old => {
          const prior = old[current.batchId];
          return { ...old, [current.batchId]: { revision: current.revision, indexes: [...new Set([...(prior?.revision === current.revision ? prior.indexes : []), current.index!])] } };
        });
      } catch {
        if (previewFrame.current === frame && frame.contentDocument === doc) setPreviewProblem("The certificate images could not be loaded. Reload the preview before continuing.");
      }
    })();
  }
  function prepareCorrection(item: Credential) {
    void action(async () => {
      const { data, error: failure } = await requireSupabaseBrowserClient().rpc("get_credential_editor_render_data", { p_batch_id:item.batch_id, p_credential_id:item.id });
      if (failure) throw failure;
      const batch = data as RenderBatch & { credentials:{ id:string; recipient_snapshot:Record<string,unknown>; template_snapshot:{text_content?:Partial<WordingContent>;wording_reference?:{type?:"library"|"legacy";id?:string;modified?:boolean}} }[] };
      const original = batch.credentials.find(credential => credential.id === item.id);
      if (!original) throw new Error("The original credential is unavailable.");
      const source = original.recipient_snapshot ?? {};
      const text = (key: string) => typeof source[key] === "string" ? source[key] as string : "";
      const ref = original.template_snapshot.wording_reference;
      const sourceRef = source.source_ref && typeof source.source_ref === "object" ? source.source_ref as {kind?:string;id?:string;label?:string;linked_name?:string} : undefined;
      setSingleInitial({ category:batch.category as CategoryCode, subtype:batch.subtype, signature:batch.signature_key as CredentialSignatureKey, authority:batch.issuing_authority,
        wording:original.template_snapshot.text_content, source:sourceRef, wordingRef:ref?.id && ref.type ? {type:ref.type,id:ref.id,modified:ref.modified ?? false} : undefined,
        recipient:{ name:item.recipient_name, role:text("role"), department:text("department"), project:text("project"), contribution:text("contribution"), service_period:text("service_period"), replaces_id:item.id, ...(text("user_id") ? {user_id:text("user_id")} : {}) } });
      setSingleVisited(true); setSingleSession(value => value + 1); setTab("editor");
    });
  }
  function reviseDraft(batch: Batch) {
    const destination = batch.entries.length > 1 ? "bulk" : "editor";
    if (destination === "bulk") { setBulkInitial({id:batch.id}); setBulkVisited(true); setBulkSession(value => value + 1); }
    else { setSingleInitial({id:batch.id}); setSingleVisited(true); setSingleSession(value => value + 1); }
    setTab(destination);
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
    <nav className="mt-7 flex flex-wrap gap-2" aria-label="Credential management sections">
      {([["dashboard","Dashboard"],["editor","Certificate Editor"],["bulk","Bulk Issuance"],["wording","Wording Library"],["records","Records & Batches"],["audit","Audit History"]] as const).map(([id,label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setWordingSeed(null); if (id === "editor") setSingleVisited(true); if (id === "bulk") setBulkVisited(true); setTab(id); }} className={tab === id ? button : "rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold"}>{label}</button>)}
    </nav>
    {tab === "dashboard" && <section className="mt-8 space-y-6"><div className="grid gap-3 sm:grid-cols-4">{[["Issued",snapshot.counts.issued],["Issued this month",snapshot.counts.issued_this_month],["Drafts / reviewed",snapshot.pending],["Revoked",snapshot.counts.revoked]].map(([label,value]) => <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--ink-muted)]">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div><div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={() => { setSingleInitial(null); setSingleVisited(true); setSingleSession(value => value + 1); setTab("editor"); }}>Create certificate</button><button type="button" className={button} onClick={() => { setBulkInitial(null); setBulkVisited(true); setBulkSession(value => value + 1); setTab("bulk"); }}>Prepare batch</button><button type="button" className={button} onClick={() => setTab("records")}>View records</button></div></section>}
    {singleVisited && <div hidden={tab !== "editor"}><CredentialVisualEditor key={singleSession} bulk={false} visible={tab === "editor"} loadAssets={loadVisualAssets} versions={wordingVersions} presets={catalog.presets} batches={snapshot.batches} legacy={snapshot.templates} organization={organization} research={research} onRefreshResearch={async () => { const latest = await listCredentialResearchSources(); setResearch(latest); return latest; }} initial={singleInitial} onLoaded={clearSingleInitial} onSaved={savedEditor} onRecords={() => setTab("records")} onSaveWording={seed => { setWordingSeed(seed); setTab("wording"); }} /></div>}
    {bulkVisited && <div hidden={tab !== "bulk"}><CredentialVisualEditor key={bulkSession} bulk visible={tab === "bulk"} loadAssets={loadVisualAssets} versions={wordingVersions} presets={catalog.presets} batches={snapshot.batches} legacy={snapshot.templates} organization={organization} research={research} onRefreshResearch={async () => { const latest = await listCredentialResearchSources(); setResearch(latest); return latest; }} initial={bulkInitial} onLoaded={clearBulkInitial} onSaved={savedEditor} onRecords={() => setTab("records")} onSaveWording={seed => { setWordingSeed(seed); setTab("wording"); }} /></div>}
    {tab === "wording" && <CredentialWordingLibrary catalog={catalog} versions={wordingVersions} legacy={snapshot.templates} refresh={refreshWordings} refreshLegacy={savedEditor} seed={wordingSeed} />}
    {tab === "records" && <>
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Recent batches</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Preview each certificate, confirm a manual layout review, then issue. Use the browser print dialog to print or save as PDF.</p>{snapshot.batches.map(batch => <div className="border-t border-[var(--line)] py-3 text-sm" key={batch.id}><p>{batch.issue_date} · {batch.entries.length} recipients · {batch.status} · {batch.signature_key}</p><div className="mt-3 flex flex-wrap gap-2"><select className={field + " !mt-0 !w-auto"} value={previewIndex[batch.id] ?? 0} onChange={e => setPreviewIndex(old => ({ ...old, [batch.id]: Number(e.target.value) }))}>{batch.entries.map((entry, index) => <option key={index} value={index}>{entry.name}</option>)}</select><button type="button" disabled={busy} className={button} onClick={() => previewBatch(batch)}>Preview</button>{["draft","reviewed"].includes(batch.status) && <><button type="button" disabled={busy} className={button} onClick={() => reviseDraft(batch)}>{batch.status === "draft" ? "Edit draft" : "Revise as new draft"}</button><button type="button" disabled={busy} className={button} onClick={() => cancelDraft(batch)}>Cancel draft</button></>}{batch.status === "issued" && process.env.NEXT_PUBLIC_CREDENTIAL_RENDERER_URL && <button type="button" disabled={busy} className={button} onClick={() => exportBatch(batch.id)}>Download PDFs as ZIP</button>}{batch.status === "draft" && <button type="button" disabled={busy || (previewedEntries[batch.id]?.indexes.length ?? 0) !== batch.entries.length} className={button} onClick={() => batchOperation(batch, "review")}>Mark reviewed</button>}{batch.status === "reviewed" && !batch.preview_verified_at && <button type="button" disabled={busy || (previewedEntries[batch.id]?.indexes.length ?? 0) !== batch.entries.length} className={button} onClick={() => batchOperation(batch, "verify")}>Confirm manual layout review</button>}{batch.status === "reviewed" && batch.preview_verified_at && <button type="button" disabled={busy} className={button} onClick={() => batchOperation(batch, "issue")}>Issue certificates</button>}</div></div>)}</section>
    {preview && <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Preview · {preview.title}</h2><div className="flex gap-2">{preview.credentialId && <button type="button" disabled={busy || Boolean(previewProblem)} className={button} onClick={printCredential}>Print / Save PDF</button>}<button type="button" onClick={() => setPreview(null)}>Close</button></div></div><p className="mt-3 text-sm text-[var(--ink-muted)]">Printing opens a separate tab. If your print dialog overrides the page settings, select A4, Landscape, and enable background graphics.</p>{previewProblem && <p role="alert" className="mt-3 text-[var(--red)]">{previewProblem}</p>}<div className="mt-4 overflow-auto"><iframe ref={previewFrame} title="Certificate preview" sandbox="allow-same-origin allow-modals" className="border-0 bg-white" style={{ width: 1123, height: 794 }} srcDoc={preview.html} onLoad={previewLoaded} /></div></section>}
    <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Issued records</h2><form className="my-4 grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); searchRecords(); }}><label className="text-sm">Name or number<input className={field} value={search} onChange={e => { setSearch(e.target.value); setResults(null); }} /></label><label className="text-sm">Category<select className={field} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setResults(null); }}><option value="">All</option>{["MEM","PAR","CON","LEA","DIS"].map(code => <option key={code}>{code}</option>)}</select></label><label className="text-sm">Department<input className={field} value={filterDepartment} onChange={e => { setFilterDepartment(e.target.value); setResults(null); }} /></label><label className="text-sm">From<input type="date" className={field} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setResults(null); }} /></label><label className="text-sm">To<input type="date" className={field} value={filterTo} onChange={e => { setFilterTo(e.target.value); setResults(null); }} /></label><div className="flex items-end"><button className={button} disabled={busy}>Search all records</button></div></form>{results === null && <p className="text-sm text-[var(--ink-muted)]">Showing recent records. Search to query the full history.</p>}{(results ?? snapshot.credentials).map(item => <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-3 text-sm" key={item.id}><span>{item.certificate_number} · {item.recipient_name} · {item.status} · {item.signature_key}</span><div className="flex gap-2"><button type="button" disabled={busy || item.status !== "issued"} className={button} onClick={() => viewCredential(item)}>View / Print</button><button type="button" disabled={busy || item.status !== "issued"} className={button} onClick={() => revoke(item)}>Revoke</button>{item.status === "revoked" && <button type="button" disabled={busy} className={button} onClick={() => prepareCorrection(item)}>Correct</button>}</div></div>)}{results && results.length === 0 && <p className="py-3 text-sm">No matching records.</p>}{results && hasMore && <button type="button" disabled={busy} onClick={() => searchRecords(true)} className={button}>Load more</button>}</section>
    </>}
    {tab === "audit" &&     <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-2xl font-bold">Audit history</h2>{audit.map(event => <details className="border-t border-[var(--line)] py-3 text-sm" key={event.id}><summary>{event.created_at} · {event.action} · {event.actor}</summary><pre className="mt-3 overflow-auto text-xs">{JSON.stringify({ batch_id: event.batch_id, credential_id: event.credential_id, ...event.details }, null, 2)}</pre></details>)}{moreAudit && <button type="button" disabled={busy} className={button} onClick={loadMoreAudit}>Load older events</button>}</section>}
  </main>;
}
