import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_DOCUMENTS,
  type LegalAcceptance,
} from "@/lib/legal/legal-config";
import { registrationConsentComplete } from "@/lib/legal/registration-consent";
import { directAccountAddress } from "./account-identifier";

export async function registerDirect(
  client: SupabaseClient,
  input: {
    identifier: string;
    displayName: string;
    password: string;
    legalAcceptance: LegalAcceptance;
  },
) {
  if (!registrationConsentComplete(input.legalAcceptance))
    throw new Error("Confirm all current platform and World policies.");
  const { data, error } = await client.functions.invoke("register-direct", {
    body: {
      ...input,
      legalAcceptance: {
        ...input.legalAcceptance,
        termsVersion: LEGAL_DOCUMENTS.terms.version,
        privacyVersion: LEGAL_DOCUMENTS.privacy.version,
      },
    },
  });
  if (error || data?.ok !== true) {
    let code: unknown;
    try {
      code = (await error?.context?.json())?.code;
    } catch {
      /* Never expose provider account details. */
    }
    throw new Error(
      code === "over_request_rate_limit"
        ? "Too many attempts. Please wait ten minutes and retry."
        : "Registration could not complete. If this login ID or email already exists, sign in or use email recovery. Otherwise retry later.",
    );
  }
  const { error: loginError } = await client.auth.signInWithPassword({
    email: await directAccountAddress(input.identifier),
    password: input.password,
  });
  if (loginError)
    throw new Error(
      "Your account was created. Sign in with the same login ID and password.",
    );
}
