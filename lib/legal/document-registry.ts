export const LEGAL_POLICY_DOCUMENTS = [
  {
    key: "terms",
    file: "terms.md",
    route: "/legal/terms/",
    title: "Terms of Use",
    scope: "platform",
    icon: "terms",
    description:
      "Participation, accounts, independent affiliations, submissions, moderation and the limits of educational tools.",
  },
  {
    key: "privacy",
    file: "privacy.md",
    route: "/legal/privacy/",
    title: "Privacy Notice",
    scope: "platform",
    icon: "privacy",
    description:
      "Personal information, responsibilities, visibility, service providers, younger participants and rights requests.",
  },
  {
    key: "community-guidelines",
    file: "community-guidelines.md",
    route: "/legal/community-guidelines/",
    title: "Community Guidelines",
    scope: "platform",
    icon: "community",
    description:
      "Respectful debate, privacy, safeguarding, responsible use of roles, reporting and proportionate review.",
  },
  {
    key: "integrity",
    file: "integrity.md",
    route: "/legal/integrity/",
    title: "Academic and Research Integrity",
    scope: "platform",
    icon: "integrity",
    description:
      "Authorship, evidence, data, AI assistance, research involving people and Research Library corrections.",
  },
  {
    key: "intellectual-property",
    file: "intellectual-property.md",
    route: "/legal/intellectual-property/",
    title: "Intellectual Property Policy",
    scope: "platform",
    icon: "rights",
    description:
      "Creator ownership, contribution permissions, research works, branding and external licensing.",
  },
  {
    key: "world/about",
    file: "world-about.md",
    route: "/legal/world/about/",
    title: "About EconMind World",
    scope: "world",
    icon: "world",
    description:
      "The original fictional simulation, its educational purpose, six Offices, authorship and full fictional-universe disclaimer.",
  },
  {
    key: "world/terms",
    file: "world-terms.md",
    route: "/legal/world/terms/",
    title: "Terms of Use",
    scope: "world",
    icon: "terms",
    description:
      "Authorised participation, economic operations, records, sharing permissions and competition responsibilities.",
  },
  {
    key: "world/privacy",
    file: "world-privacy.md",
    route: "/legal/world/privacy/",
    title: "Privacy Notice",
    scope: "world",
    icon: "privacy",
    description:
      "World participation data, commands, reports, access boundaries, retention and privacy requests.",
  },
] as const;

export type PolicyDocument = (typeof LEGAL_POLICY_DOCUMENTS)[number];
export function policyByKey(key: string) {
  return LEGAL_POLICY_DOCUMENTS.find((document) => document.key === key);
}
