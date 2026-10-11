import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_DOCUMENTS,
  type LegalAcceptance,
} from "@/lib/legal/legal-config";
import {
  requireSupabaseBrowserClient as client,
  throwIfSupabaseError as fail,
} from "./client";

const rejected =
  "Could not complete group registration. Check the group code and your original password, or use sign in or email recovery.";
export async function registerWithGroupCode(
  supabase: SupabaseClient,
  input: {
    email: string;
    password: string;
    code: string;
    displayName: string;
    legalAcceptance: LegalAcceptance;
  },
) {
  const { data, error } = await supabase.functions.invoke(
    "register-with-group-code",
    {
      body: {
        ...input,
        legalAcceptance: {
          ...input.legalAcceptance,
          termsVersion: LEGAL_DOCUMENTS.terms.version,
          privacyVersion: LEGAL_DOCUMENTS.privacy.version,
        },
      },
    },
  );
  if (error || data?.ok !== true) {
    let code: unknown;
    try {
      code = (await error?.context?.json())?.code;
    } catch {
      /* transport failure */
    }
    throw new Error(
      code === "over_request_rate_limit"
        ? "Too many registration attempts. Please wait ten minutes before trying again."
        : code === "group_registration_unavailable"
          ? "Group registration is unavailable. Use email verification or Google sign-in."
          : rejected,
    );
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (signInError)
    throw new Error(
      "Your registration was accepted. Sign in with your original password, or use email recovery.",
    );
  const { error: consentError } = await supabase.rpc(
    "accept_current_legal_documents",
    {
      p_terms_version: LEGAL_DOCUMENTS.terms.version,
      p_privacy_version: LEGAL_DOCUMENTS.privacy.version,
    },
  );
  if (consentError)
    throw new Error(
      "Your account is active. Please complete the legal acknowledgement after signing in.",
    );
}

export type GroupRegistrationPolicy = {
  enabled: boolean;
  has_code: boolean;
  is_open: boolean;
  expires_at: string | null;
  changed_at: string;
};
export async function getGroupRegistrationPolicy(): Promise<GroupRegistrationPolicy> {
  const { data, error } = await client().rpc("get_group_registration_policy");
  fail(error);
  return data as GroupRegistrationPolicy;
}
export async function setGroupRegistrationPolicy(
  code: string | null,
  enabled: boolean,
  expiresAt: string | null,
) {
  const { error } = await client().rpc("set_group_registration_policy", {
    p_code: code,
    p_enabled: enabled,
    p_expires_at: expiresAt,
  });
  fail(error);
}
