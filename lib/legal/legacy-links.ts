export const LEGACY_POLICY_ANCHORS: Record<string, Record<string, string>> = {
  terms: {
    service: "1-the-platform-and-these-terms",
    accounts: "3-eligibility-and-accounts",
    conduct: "5-acceptable-use",
    content: "6-your-submissions-and-permissions",
    brand: "7-intellectual-property-and-branding",
    availability: "10-availability-and-responsibility",
    enforcement: "9-moderation-and-review",
    changes: "11-leaving-and-changes-to-these-terms",
  },
  privacy: {
    scope: "2-scope-and-collection",
    information: "2-scope-and-collection",
    "google-sign-in": "2-scope-and-collection",
    uses: "3-purposes-and-legal-grounds",
    sharing: "4-who-can-see-information",
    providers: "5-service-providers-and-cross-border-access",
    retention: "6-retention-and-deletion",
    choices: "8-security-and-rights",
    minors: "7-children-and-guardians",
    changes: "9-updates",
  },
  "community-guidelines": {
    purpose: "1-a-respectful-academic-community",
    expectations: "2-debate-ideas-responsibly",
    report: "6-report-concerns",
    response: "7-proportionate-response-and-reconsideration",
  },
  integrity: {
    principle: "1-honest-reasoning-and-evidence",
    work: "7-organised-academic-activities",
    review: "8-corrections-and-review",
  },
};
export function migratedPolicyHash(document: string, hash: string) {
  const anchor = hash.replace(/^#/, "");
  return anchor
    ? `#${LEGACY_POLICY_ANCHORS[document]?.[anchor] || anchor}`
    : "";
}
