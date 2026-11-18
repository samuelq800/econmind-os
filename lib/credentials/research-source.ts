import type { CredentialResearchSource } from "@/lib/supabase/credential-research-sources";

export type ResearchReference = {
  kind: "research"; id: string; label: string; paper_title: string;
  author_display_name: string; coauthors_text: string; paper_status: string;
  paper_updated_at: string; verified_author: string; status_reviewed: string; paper_published_at: string;
  linked_name?: string;
};
export function researchReference(paper: CredentialResearchSource, author: string, statusReviewed: boolean): ResearchReference {
  return { kind: "research", id: paper.paper_id, label: paper.title, paper_title: paper.title,
    author_display_name: paper.author_display_name ?? "", coauthors_text: paper.coauthors_text ?? "",
    paper_status: paper.status, paper_updated_at: paper.updated_at, verified_author: author.trim(),
    status_reviewed: statusReviewed ? "true" : "false", paper_published_at: paper.published_at ?? "" };
}
export function researchChanged(source: Omit<Partial<ResearchReference>, "kind">, paper?: CredentialResearchSource): boolean {
  return !paper || source.paper_title !== paper.title || source.author_display_name !== (paper.author_display_name ?? "") ||
    source.coauthors_text !== (paper.coauthors_text ?? "") || source.paper_status !== paper.status || source.paper_updated_at !== paper.updated_at;
}
/** Do not parse or infer identities from unstructured coauthor text. */
export function authorAppearsInSource(author: string, paper: CredentialResearchSource): boolean {
  const name = author.trim();
  return !!name && (name === paper.author_display_name?.trim() || (paper.coauthors_text ?? "").split(/[,;，；\n]/u).some(part => part.trim() === name));
}
