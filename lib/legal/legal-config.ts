export const LEGAL_EFFECTIVE_DATE = "2026-08-27";

export const LEGAL_DOCUMENTS = {
  terms: {
    key: "terms",
    title: "Terms of Use",
    version: "1.2",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  privacy: {
    key: "privacy",
    title: "Privacy Notice",
    version: "1.1",
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

/**
 * This switch is intentionally off for the first public release. Existing
 * account holders remain uninterrupted; it can be enabled alongside a new
 * version when a material policy change genuinely requires reconfirmation.
 */
export const LEGAL_RECONSENT = {
  terms: false,
  privacy: false,
} as const;

export type LegalAcceptance = {
  terms: boolean;
  privacy: boolean;
};

export function registrationConsentValid(acceptance: LegalAcceptance) {
  return acceptance.terms && acceptance.privacy;
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
  return consents.some((entry) => entry.document_type === "terms" && entry.document_version === LEGAL_DOCUMENTS.terms.version)
    && consents.some((entry) => entry.document_type === "privacy" && entry.document_version === LEGAL_DOCUMENTS.privacy.version);
}

export function needsLegalReconsent(
  accepted: Partial<Record<LegalDocumentKey, string>>,
) {
  return (LEGAL_RECONSENT.terms && accepted.terms !== LEGAL_DOCUMENTS.terms.version)
    || (LEGAL_RECONSENT.privacy && accepted.privacy !== LEGAL_DOCUMENTS.privacy.version);
}
