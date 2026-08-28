import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError as fail,
} from "./client";

export const VIEWER_INVITATION_STORAGE_KEY = "econmind.viewer-invitation-code";

export type ViewerInvitationAccess = {
  label: string | null;
  expiresAt: string | null;
};

export type ViewerInvitation = ViewerInvitationAccess & {
  id: string;
  isActive: boolean;
  createdAt: string;
};

function normaliseInvitationCode(code: string) {
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function readSavedViewerInvitationCode() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(VIEWER_INVITATION_STORAGE_KEY);
}

export function saveViewerInvitationCode(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VIEWER_INVITATION_STORAGE_KEY, code);
}

export function clearSavedViewerInvitationCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(VIEWER_INVITATION_STORAGE_KEY);
}

export async function validateViewerInvitationCode(code: string): Promise<ViewerInvitationAccess | null> {
  const normalised = normaliseInvitationCode(code);
  if (normalised.length < 12) return null;
  const { data, error } = await client().rpc("validate_viewer_invitation_code", { p_code: normalised });
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") return null;
  const typed = row as { label?: unknown; expires_at?: unknown };
  return {
    label: typeof typed.label === "string" ? typed.label : null,
    expiresAt: typeof typed.expires_at === "string" ? typed.expires_at : null,
  };
}

export async function listViewerInvitationCodes(): Promise<ViewerInvitation[]> {
  const { data, error } = await client().rpc("list_viewer_invitation_codes");
  fail(error);
  return (data ?? []).map((row: unknown) => {
    const typed = row as { id: string; label: string | null; is_active: boolean; expires_at: string | null; created_at: string };
    return { id: typed.id, label: typed.label, isActive: typed.is_active, expiresAt: typed.expires_at, createdAt: typed.created_at };
  });
}

export async function createViewerInvitationCode(input: { label?: string; expiresAt?: string | null }) {
  const { data, error } = await client().rpc("create_viewer_invitation_code", {
    p_label: input.label?.trim() || null,
    p_expires_at: input.expiresAt ?? null,
  });
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") throw new Error("Could not create the viewer invitation.");
  const typed = row as { id: string; invitation_code: string; label: string | null; expires_at: string | null };
  return { id: typed.id, invitationCode: typed.invitation_code, label: typed.label, expiresAt: typed.expires_at };
}

export async function setViewerInvitationActive(invitationId: string, active: boolean) {
  const { error } = await client().rpc("set_viewer_invitation_active", {
    p_invitation_id: invitationId,
    p_active: active,
  });
  fail(error);
}
