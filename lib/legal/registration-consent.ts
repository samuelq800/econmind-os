import {
  allPoliciesChecked,
  POLICY_ACKNOWLEDGEMENT_RELEASE,
  type PolicyChecks,
} from "./policy-release.ts";
import type { LegalAcceptance } from "./legal-config.ts";

export function registrationPolicyMetadata(acceptance: LegalAcceptance) {
  if (!registrationConsentComplete(acceptance)) return undefined;
  return {
    release_id: POLICY_ACKNOWLEDGEMENT_RELEASE,
    checks: { ...acceptance.policies },
  };
}
export function registrationConsentComplete(acceptance: LegalAcceptance) {
  return (
    acceptance.terms === true &&
    acceptance.privacy === true &&
    allPoliciesChecked(acceptance.policies ?? {})
  );
}
const OAUTH_KEY = "econmind.registration-policy-oauth.v2";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function rememberOAuthRegistrationConsent(
  acceptance: LegalAcceptance,
  storage: StorageLike = sessionStorage,
  now = Date.now(),
) {
  const receipt = registrationPolicyMetadata(acceptance);
  if (!receipt)
    throw new Error("Confirm all current policies before registering.");
  storage.setItem(
    OAUTH_KEY,
    JSON.stringify({ ...receipt, expiresAt: now + 30 * 60_000 }),
  );
}
export function pendingOAuthRegistrationConsent(
  storage?: StorageLike,
  now = Date.now(),
): PolicyChecks | null {
  try {
    storage ??= sessionStorage;
    const draft = JSON.parse(storage.getItem(OAUTH_KEY) ?? "null");
    if (
      draft?.release_id === POLICY_ACKNOWLEDGEMENT_RELEASE &&
      typeof draft.expiresAt === "number" &&
      draft.expiresAt > now &&
      draft.expiresAt <= now + 30 * 60_000 &&
      allPoliciesChecked(draft.checks)
    )
      return draft.checks;
  } catch {
    /* Invalid or unavailable browser storage is never consent. */
  }
  try {
    storage?.removeItem(OAUTH_KEY);
  } catch {
    /* Restricted storage is not consent. */
  }
  return null;
}
export const clearOAuthRegistrationConsent = (storage?: StorageLike) => {
  try {
    (storage ?? sessionStorage).removeItem(OAUTH_KEY);
  } catch {
    /* Never block an existing signed-in account on storage cleanup. */
  }
};
