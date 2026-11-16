import { requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

/** Research submissions are source records, not verified credential recipients. */
export type CredentialResearchSource = {
  paper_id: string;
  uploader_user_id: string;
  author_display_name: string;
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
