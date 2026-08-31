import { requireSupabaseBrowserClient as client, throwIfSupabaseError as fail } from "@/lib/supabase/client";

export type AccountAccessState = { suspended: boolean; changedAt: string | null };

type AccountAccessResponse = { ok: boolean; suspended?: boolean; changedAt?: string | null; message?: string };

async function invoke(action: "status" | "suspend" | "restore") {
  const { data, error } = await client().functions.invoke("moderate-account-access", { body: { action } });
  fail(error);
  const response = data as AccountAccessResponse;
  if (!response?.ok || typeof response.suspended !== "boolean") throw new Error(response?.message ?? "Account access control is unavailable.");
  return { suspended: response.suspended, changedAt: response.changedAt ?? null } satisfies AccountAccessState;
}

export function getDesignatedAccountAccessStatus() {
  return invoke("status");
}

export function setDesignatedAccountAccess(suspended: boolean) {
  return invoke(suspended ? "suspend" : "restore");
}
