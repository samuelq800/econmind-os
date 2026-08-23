import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type SupportCategory = "general" | "privacy" | "account_deletion" | "report" | "league_appeal" | "security";
export type SupportStatus = "open" | "reviewing" | "resolved" | "closed";

export type SupportRequest = {
  id: string;
  user_id: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
  target_type: string | null;
  target_reference: string | null;
  status: SupportStatus;
  public_response: string | null;
  internal_note?: string | null;
  assigned_admin_user_id?: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: { display_name: string | null } | null;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createSupportRequest(input: {
  category: SupportCategory;
  subject: string;
  message: string;
  targetType?: string;
  targetReference?: string;
}) {
  const supabase = client();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  fail(authError);
  if (!auth.user) throw new Error("Sign in with an individual account to submit a request.");

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: auth.user.id,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      target_type: input.targetType?.trim() || null,
      target_reference: input.targetReference?.trim() || null,
    })
    .select("*")
    .single();
  fail(error);
  return data as SupportRequest;
}

export async function listMySupportRequests() {
  const { data, error } = await client()
    .from("support_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  fail(error);
  return (data ?? []) as SupportRequest[];
}

export async function listAdminSupportRequests() {
  const { data, error } = await client()
    .from("support_requests")
    .select("*, requester:profiles!support_requests_user_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  fail(error);
  return (data ?? []) as SupportRequest[];
}

export async function reviewSupportRequest(input: {
  requestId: string;
  status: SupportStatus;
  publicResponse?: string;
  internalNote?: string;
  action?: "reviewed" | "responded" | "resolved" | "closed" | "content_hidden" | "content_removed" | "attempt_invalidated" | "access_restricted" | "access_restored";
  outcome?: string;
}) {
  const { data, error } = await client().rpc("review_support_request", {
    p_request_id: input.requestId,
    p_status: input.status,
    p_public_response: input.publicResponse?.trim() || null,
    p_internal_note: input.internalNote?.trim() || null,
    p_action: input.action ?? null,
    p_outcome: input.outcome?.trim() || null,
  });
  fail(error);
  return data as SupportRequest;
}

export async function listMyLegalConsents() {
  const { data, error } = await client()
    .from("user_consents")
    .select("document_type,document_version,accepted_at")
    .order("accepted_at", { ascending: false });
  fail(error);
  return (data ?? []) as Array<{ document_type: "terms" | "privacy"; document_version: string; accepted_at: string }>;
}

export async function acceptCurrentLegalDocuments(termsVersion: string, privacyVersion: string) {
  const { error } = await client().rpc("accept_current_legal_documents", {
    p_terms_version: termsVersion,
    p_privacy_version: privacyVersion,
  });
  fail(error);
}
