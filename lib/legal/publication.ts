/** Published document metadata is deliberately separate from legacy Auth receipts. */
export const POLICY_PUBLICATION = {
  version: "2.0",
  releaseDate: "2026-10-21",
  source: "League review R2 · 21 October 2026",
  worldEdition: "21 October 2026",
} as const;

export const POLICY_SCOPE =
  "Main-platform policies cover the core education platform and shared services within their stated scope. World-specific documents cover EconMind World and Season 1. Linking them here does not automatically incorporate World rules into the main-platform Terms.";

export const CONSENT_PUBLICATION_NOTICE =
  "The current published documents are available below. Existing account acknowledgement records remain Terms v1.2 and Privacy v1.1; this release does not create a v2.0 consent record or change existing permissions. Version-specific acknowledgement activation remains pending.";

export const LEGACY_POLICY_ROUTES = {
  "/terms": "/legal/terms/",
  "/privacy": "/legal/privacy/",
  "/community-guidelines": "/legal/community-guidelines/",
  "/integrity": "/legal/integrity/",
  "/intellectual-property": "/legal/intellectual-property/",
} as const;
