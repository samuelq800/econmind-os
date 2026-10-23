import {
  allPoliciesChecked,
  emptyPolicyChecks,
  type PolicyChecks,
} from "./policy-release.ts";

export const LEGAL_EFFECTIVE_DATE = "2026-10-21";

export const LEGAL_DOCUMENTS = {
  terms: {
    key: "terms",
    title: "Terms of Use",
    version: "2.0",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  privacy: {
    key: "privacy",
    title: "Privacy Notice",
    version: "2.0",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

/**
 * Owner-authorised confirmation of the published October update. The complete
 * eight-document receipt is coordinated separately by release identity.
 */
export const LEGAL_RECONSENT = {
  terms: true,
  privacy: true,
} as const;

export type LegalAcceptance = {
  terms: boolean;
  privacy: boolean;
  policies?: PolicyChecks;
};

export const emptyRegistrationConsent = (): LegalAcceptance => ({
  terms: false,
  privacy: false,
  policies: emptyPolicyChecks(),
});

/** Cached pre-update registration clients remain usable but never count as v2 confirmation. */
export function acceptedRegistrationLegalPair(
  terms: unknown,
  privacy: unknown,
) {
  return (
    (terms === "2.0" && privacy === "2.0") ||
    (terms === "1.2" && privacy === "1.1")
  );
}

export function registrationConsentValid(acceptance: LegalAcceptance) {
  return (
    acceptance.terms &&
    acceptance.privacy &&
    (acceptance.policies === undefined ||
      allPoliciesChecked(acceptance.policies))
  );
}

export function requiredConsentVersions() {
  return {
    terms: LEGAL_DOCUMENTS.terms.version,
    privacy: LEGAL_DOCUMENTS.privacy.version,
  };
}

/** Initial account setup requires both current documents; material re-consent is separate. */
export function hasInitialLegalConsent(
  consents: ReadonlyArray<{ document_type: string; document_version: string }>,
) {
  return (
    consents.some(
      (entry) =>
        entry.document_type === "terms" &&
        entry.document_version === LEGAL_DOCUMENTS.terms.version,
    ) &&
    consents.some(
      (entry) =>
        entry.document_type === "privacy" &&
        entry.document_version === LEGAL_DOCUMENTS.privacy.version,
    )
  );
}

export function needsLegalReconsent(
  accepted: Partial<Record<LegalDocumentKey, string>>,
) {
  return (
    (LEGAL_RECONSENT.terms &&
      accepted.terms !== LEGAL_DOCUMENTS.terms.version) ||
    (LEGAL_RECONSENT.privacy &&
      accepted.privacy !== LEGAL_DOCUMENTS.privacy.version)
  );
}
