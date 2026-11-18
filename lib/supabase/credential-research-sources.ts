import { requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

/** Research submissions are source records, not verified credential recipients. */
export type CredentialResearchSource = {
  paper_id: string;
  uploader_user_id: string;
  author_display_name: string;
  owner_name_matches: boolean | null;
  coauthors_text: string | null;
  title: string;
  subject: string;
  institution: string;
  status: string;
  published_at: string | null;
  updated_at: string;
};

/** Fetch all uploaded records on demand; never silently stop at a server row cap. */
export async function listCredentialResearchSources(): Promise<CredentialResearchSource[]> {
  const client = requireSupabaseBrowserClient();
  const result: CredentialResearchSource[] = [];
  let cursor: string | null = null;
  for (;;) {
    const { data, error } = await client.rpc("list_credential_research_sources", {
      p_after_id: cursor,
      p_limit: 100,
    });
    throwIfSupabaseError(error);
    if (!Array.isArray(data)) throw new Error("Research source response is unavailable.");
    const page = data as CredentialResearchSource[];
    for (const row of page) {
      if (!row.paper_id || (cursor !== null && row.paper_id <= cursor)) {
        throw new Error("Research source pagination returned an invalid order.");
      }
      result.push(row);
      cursor = row.paper_id;
    }
    if (page.length < 100) return result;
  }
}

export async function getCredentialResearchSource(paperId: string): Promise<CredentialResearchSource | null> {
  const { data, error } = await requireSupabaseBrowserClient().rpc("get_credential_research_source", { p_paper_id: paperId });
  throwIfSupabaseError(error);
  return data as CredentialResearchSource | null;
}

/** Realtime is an invalidation signal; the guarded RPC remains authoritative. */
export function watchCredentialResearchSources(onUpdate: (rows: CredentialResearchSource[]) => void, onError: (error: Error) => void): () => void {
  const client = requireSupabaseBrowserClient();
  let disposed = false;
  let running = false;
  let queued = false;
  async function refresh() {
    if (disposed) return;
    if (running) { queued = true; return; }
    running = true;
    try {
      const rows = await listCredentialResearchSources();
      if (!disposed) onUpdate(rows);
    } catch (error) {
      if (!disposed) onError(error instanceof Error ? error : new Error("Could not load research sources."));
    } finally {
      running = false;
      if (queued && !disposed) { queued = false; void refresh(); }
    }
  }
  const channel = client.channel("credential-research-source-revision")
    .on("postgres_changes", { event: "*", schema: "public", table: "credential_source_revisions", filter: "source=eq.research" }, () => { void refresh(); })
    .subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
  void refresh();
  const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
  const visibility = () => { if (document.visibilityState === "visible") void refresh(); };
  document.addEventListener("visibilitychange", visibility);
  return () => { disposed = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); void client.removeChannel(channel); };
}
