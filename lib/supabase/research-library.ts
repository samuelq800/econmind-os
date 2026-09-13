import type { ResearchPaper, ResearchPaperSubmission, ResearchPaperStatus } from "@/lib/research/types";
import { getSupabaseBrowserClient, requireSupabaseBrowserClient, throwIfSupabaseError } from "./client";

const PDF_MIME = "application/pdf";
export const MAX_RESEARCH_PDF_BYTES = 25 * 1024 * 1024;

function text(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function submissionPayload(input: ResearchPaperSubmission) {
  return {
    p_title: input.title.trim(),
    p_author_display_name: input.author_display_name.trim(),
    p_school_display_name: input.school_display_name.trim(),
    p_subject: input.subject.trim(),
    p_competition_text: text(input.competition_text),
    p_competition_year: input.competition_year ?? null,
    p_award_text: text(input.award_text),
    p_abstract: text(input.abstract),
    p_keywords: text(input.keywords),
    p_description: text(input.description),
    p_coauthors_text: text(input.coauthors_text),
    p_ai_linking_consent: input.ai_linking_consent,
    // Research Library uploads are always publicly readable. Keep the form
    // field in the RPC shape for backward compatibility with the deployed DB.
    p_visibility: "public",
  };
}

export function validateResearchPdf(file: File) {
  const validType = file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf");
  if (!validType) throw new Error("Please choose a PDF file.");
  if (file.size <= 0) throw new Error("The selected PDF is empty.");
  if (file.size > MAX_RESEARCH_PDF_BYTES) throw new Error("PDF files must be 25 MB or smaller.");
}

export async function listPublishedResearch(query: string, sort: "newest" | "oldest") {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [] as ResearchPaper[];
  let request = supabase.from("research_papers").select("*");
  const needle = query.trim().replace(/[%,()]/g, " ");
  if (needle) {
    request = request.or(`title.ilike.%${needle}%,author_display_name.ilike.%${needle}%,school_display_name.ilike.%${needle}%,subject.ilike.%${needle}%,competition_text.ilike.%${needle}%`);
  }
  const { data, error } = await request.order("published_at", { ascending: sort === "oldest", nullsFirst: false });
  throwIfSupabaseError(error);
  return (data ?? []) as ResearchPaper[];
}

export async function listFeaturedResearch() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [] as ResearchPaper[];
  const { data, error } = await supabase.from("research_papers").select("*").eq("featured", true).order("published_at", { ascending: false });
  throwIfSupabaseError(error);
  return (data ?? []) as ResearchPaper[];
}

export async function getResearchPaper(paperId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("research_papers").select("*").eq("id", paperId).maybeSingle();
  throwIfSupabaseError(error);
  return data as ResearchPaper | null;
}

export async function listMyResearch() {
  const supabase = requireSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfSupabaseError(authError);
  if (!authData.user) throw new Error("An authenticated account is required.");
  const { data, error } = await supabase.from("research_papers").select("*").eq("owner_user_id", authData.user.id).order("updated_at", { ascending: false });
  throwIfSupabaseError(error);
  return (data ?? []) as ResearchPaper[];
}

export async function listResearchForAdmin() {
  const { data, error } = await requireSupabaseBrowserClient().from("research_papers").select("*").order("updated_at", { ascending: false });
  throwIfSupabaseError(error);
  return (data ?? []) as ResearchPaper[];
}

export async function createResearchPaper(input: ResearchPaperSubmission) {
  const { data, error } = await requireSupabaseBrowserClient().rpc("create_research_paper", {
    ...submissionPayload(input),
    p_publication_permission: true,
  });
  throwIfSupabaseError(error);
  return data as ResearchPaper;
}

export async function updateResearchPaper(paperId: string, input: ResearchPaperSubmission) {
  const { data, error } = await requireSupabaseBrowserClient().rpc("update_research_paper_submission", {
    p_paper_id: paperId,
    ...submissionPayload(input),
  });
  throwIfSupabaseError(error);
  return data as ResearchPaper;
}

export async function uploadResearchPdf(userId: string, paperId: string, file: File) {
  validateResearchPdf(file);
  const path = `${userId}/${paperId}/paper.pdf`;
  const { error } = await requireSupabaseBrowserClient().storage.from("research-papers").upload(path, file, {
    contentType: PDF_MIME,
    upsert: false,
  });
  throwIfSupabaseError(error);
  return path;
}

export async function attachResearchPdf(paperId: string, path: string, file: File) {
  const { data, error } = await requireSupabaseBrowserClient().rpc("attach_research_paper_file", {
    p_paper_id: paperId,
    p_file_path: path,
    p_file_name: file.name.slice(0, 240),
    p_file_size: file.size,
  });
  throwIfSupabaseError(error);
  return data as ResearchPaper;
}

export async function getResearchPdfUrl(filePath: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("research-papers").createSignedUrl(filePath, 60 * 30);
  throwIfSupabaseError(error);
  if (!data?.signedUrl) throw new Error("Could not create a secure PDF link.");
  return data.signedUrl;
}

export async function reviewResearchPaper(input: {
  paperId: string;
  status: Extract<ResearchPaperStatus, "published" | "unpublished">;
  internalNote: string;
  awardVerified: boolean;
  featured: boolean;
}) {
  const { data, error } = await requireSupabaseBrowserClient().rpc("review_research_paper", {
    p_paper_id: input.paperId,
    p_status: input.status,
    p_admin_review_note: text(input.internalNote),
    p_award_verified: input.awardVerified,
    p_featured: input.featured,
  });
  throwIfSupabaseError(error);
  return data as ResearchPaper;
}

export async function updateResearchPaperAsAdmin(paperId: string, input: ResearchPaperSubmission) {
  const { data, error } = await requireSupabaseBrowserClient().from("research_papers").update({
    title: input.title.trim(),
    author_display_name: input.author_display_name.trim(),
    school_display_name: input.school_display_name.trim(),
    subject: input.subject.trim(),
    competition_text: text(input.competition_text),
    competition_year: input.competition_year ?? null,
    award_text: text(input.award_text),
    abstract: text(input.abstract),
    keywords: text(input.keywords),
    description: text(input.description),
    coauthors_text: text(input.coauthors_text),
    ai_linking_consent: input.ai_linking_consent,
    visibility: "public",
  }).eq("id", paperId).select("*").single();
  throwIfSupabaseError(error);
  return data as ResearchPaper;
}
