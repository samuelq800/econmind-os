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
  "Current platform documents are version 2.0. Earlier acknowledgement records are preserved as history and are not upgraded automatically. Signed-in accounts confirm the current platform and World documents individually; reading policies alone does not record agreement or grant permissions.";

export const LEGACY_POLICY_ROUTES = {
  "/terms": "/legal/terms/",
  "/privacy": "/legal/privacy/",
  "/community-guidelines": "/legal/community-guidelines/",
  "/integrity": "/legal/integrity/",
  "/intellectual-property": "/legal/intellectual-property/",
} as const;
