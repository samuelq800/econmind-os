export type ResearchPaperStatus = "draft" | "pending_review" | "published" | "unpublished" | "revision_requested" | "rejected";
export type ResearchVisibility = "public";

export type ResearchPaper = {
  id: string;
  owner_user_id: string;
  title: string;
  author_display_name: string;
  school_display_name: string;
  subject: string;
  competition_text: string | null;
  competition_year: number | null;
  award_text: string | null;
  award_verified: boolean;
  abstract: string | null;
  keywords: string | null;
  description: string | null;
  coauthors_text: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  visibility: ResearchVisibility;
  status: ResearchPaperStatus;
  featured: boolean;
  view_count: number;
  admin_review_note: string | null;
  publication_permission_at: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type ResearchPaperSubmission = Pick<
  ResearchPaper,
  | "title"
  | "author_display_name"
  | "school_display_name"
  | "subject"
  | "competition_text"
  | "competition_year"
  | "award_text"
  | "abstract"
  | "keywords"
  | "description"
  | "coauthors_text"
  | "visibility"
>;
