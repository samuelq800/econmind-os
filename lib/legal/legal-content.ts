import { LEGAL_DOCUMENTS } from "@/lib/legal/legal-config";

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: "scope",
    heading: "1. Scope and plain-language summary",
    paragraphs: [
      "This notice explains how EconMind OS handles personal information when you use its economics learning tools, school and team workspace, public League directory, and support form. EconMind OS is an educational platform. It is not a financial advisory, trading, or commercial forecasting service.",
      "We collect only the information needed to run the features that are available on the site, keep learning work and account controls functioning, and protect the community. We do not sell personal information or run advertising profiles.",
    ],
  },
  {
    id: "information",
    heading: "2. Information we handle",
    bullets: [
      "Account information: the email address and authentication identifier managed by Supabase Auth, plus an optional display name supplied at registration.",
      "Optional profile information: graduation year, economics club name, role preference, school association, team membership, and League role where you choose or are assigned to provide them.",
      "Learning and workspace records: saved model runs, parameters and results, favourites, learning progress, case work, experiment responses, challenge attempts, and any explanations or text you submit to a feature.",
      "League and published-work records: school, team, role, official attempt, policy or project records required for an active learning activity. Public League directories show only the released school or team information designed for that directory, such as school/team identity, aggregate participation, and selected leadership identity.",
      "Support and integrity records: requests sent through the in-site Contact form, reports, administrator responses, and internal moderation or audit notes needed to process those requests fairly.",
      "Technical storage: the browser may store your Supabase session, theme preference, local drafts, invitation state, and recently used learning controls. These items help the site work and are not used for advertising profiling.",
    ],
  },
  {
    id: "uses",
    heading: "3. Why we use information",
    bullets: [
      "to create and secure your account, maintain your session, and provide saved-work features;",
      "to run the learning, challenge, school, and team functions you choose to use;",
      "to show intentionally public school and team directory information;",
      "to process support, privacy, access, deletion, safety, and integrity requests;",
      "to investigate misuse, enforce the Community Guidelines, and maintain a safe educational environment; and",
      "to maintain, troubleshoot, and improve the service without using personal information for advertising or sale.",
    ],
  },
  {
    id: "sharing",
    heading: "4. Visibility and sharing",
    paragraphs: [
      "Your email address, authentication identifier, private saved work, private drafts, and administrator notes are not shown in the public directory. A normal profile is limited to the display name you choose; school, team, and role information appears only where a League workflow needs it.",
      "Some Team-page contact cards are an editorial directory exception. They are published only for people who have expressly agreed to public display of those contact details. Those contact cards are not copied into ordinary member profiles or search results.",
      "Selected reports, school/team information, challenge outcomes, or project results may be visible to the audience stated in that feature. If a feature offers a share link, treat the link as access to the selected report and avoid sending it to people who should not see it.",
    ],
  },
  {
    id: "providers",
    heading: "5. Storage and service providers",
    paragraphs: [
      "EconMind OS uses Supabase for authentication and database storage. Access to application records is protected by Row Level Security so that ordinary signed-in users can access their own records only, while platform administrators have narrowly scoped administrative access for the services they operate.",
      "The public site is delivered through its configured web hosting and source-control deployment. We do not currently use a paid external AI API to generate learning answers or profile users. Economics calculations in the interactive models run in the browser unless a feature clearly saves a result you ask to keep.",
    ],
  },
  {
    id: "retention",
    heading: "6. Retention and account deletion",
    paragraphs: [
      "We keep account and learning information only for as long as it is useful for the educational service, support, security, and legitimate record-keeping needs. The appropriate period depends on the type of record and whether it forms part of a shared League activity.",
      "You can submit an account-deletion request from your Profile page. A platform administrator reviews it to avoid accidentally removing shared team or League records that affect other participants. Private account information and personal workspace records are removed or anonymised where appropriate; shared historical records may be retained in de-identified form when needed to preserve the integrity of an activity.",
    ],
  },
  {
    id: "choices",
    heading: "7. Your choices and requests",
    paragraphs: [
      "You can edit optional profile information from your Profile page and submit a privacy, access, correction, or deletion request through the in-site Contact form. Your request status and the administrator's final response are visible in your profile. For security, account-deletion requests must be made from the signed-in account concerned.",
      "The platform does not currently operate behavioural advertising cookies or a third-party marketing analytics programme. Essential browser storage is used for authentication, preferences, and local drafts. If that changes materially, this notice and the consent flow will be updated before the change is relied upon.",
    ],
  },
  {
    id: "minors",
    heading: "8. School and younger users",
    paragraphs: [
      "EconMind OS is designed for school and community learning. Students should use it in accordance with their school, parent or guardian, and applicable local requirements. Schools and adult coordinators remain responsible for deciding whether and how their students may participate in a particular activity.",
    ],
  },
  {
    id: "changes",
    heading: "9. Updates and contact",
    paragraphs: [
      "This notice is versioned so changes can be understood. Existing users are not interrupted for routine wording or operational updates. For a material change, EconMind OS may request renewed acknowledgement before a relevant feature is used again.",
      `Current version: Privacy Notice v${LEGAL_DOCUMENTS.privacy.version}, effective ${LEGAL_DOCUMENTS.privacy.effectiveDate}. For questions or requests, use the signed-in Contact form so the appropriate platform administrator can respond securely.`,
    ],
  },
];

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    id: "service",
    heading: "1. The service",
    paragraphs: [
      "EconMind OS provides interactive economics models, simulations, cases, challenges, school/team workspaces, and related learning materials. The platform is designed to support reasoning, discussion, and learning. It does not provide investment, legal, tax, medical, or other professional advice.",
      "Models, scenarios, and visualisations are simplified educational representations. Their outputs are not predictions, guarantees, or real-world policy recommendations.",
    ],
  },
  {
    id: "accounts",
    heading: "2. Accounts and eligibility",
    paragraphs: [
      "You must provide accurate account information and keep your password secure. Do not share a personal account. Invitation-code access is deliberately view-only and cannot create saved work, school membership, or operational changes.",
      "If you are participating through a school, follow the participation arrangements set by your school and any applicable parent, guardian, or local requirements. Platform administrators may require reasonable verification before granting school, team, professor, or other elevated roles.",
    ],
  },
  {
    id: "conduct",
    heading: "3. Acceptable use",
    bullets: [
      "Use the platform lawfully, honestly, and for educational or authorised community purposes.",
      "Do not attempt to bypass access controls, impersonate another person, scrape private information, introduce malicious code, or disrupt the service.",
      "Do not submit personal, unlawful, harassing, discriminatory, threatening, deceptive, or infringing content.",
      "Do not misrepresent a model output, official attempt, school affiliation, or shared work as real-world evidence or another person's work.",
      "Respect the Community Guidelines and Integrity expectations that apply to the feature you are using.",
    ],
  },
  {
    id: "content",
    heading: "4. Your content and shared work",
    paragraphs: [
      "You keep rights in original text and other material you submit. You give EconMind OS the limited permission needed to store, display to the selected feature audience, process, moderate, and maintain that material in order to operate the service.",
      "Only submit material you have the right to use. Shared team and League activities may preserve a record of submissions, outcomes, or contributions so that the activity remains understandable to other participants. Public sharing occurs only where the feature or directory indicates it.",
    ],
  },
  {
    id: "availability",
    heading: "5. Availability and changes",
    paragraphs: [
      "We aim to keep EconMind OS available and accurate, but the service may change, be unavailable, or contain errors. We may update, pause, or retire features where necessary for safety, maintenance, educational quality, or capacity. We will avoid unnecessary disruption to existing learning records where practical.",
    ],
  },
  {
    id: "enforcement",
    heading: "6. Enforcement and reporting",
    paragraphs: [
      "Platform administrators may review reports and take proportionate steps, including clarifying a rule, limiting a feature, hiding content, invalidating an attempt, changing an administrative status, or suspending access when necessary to protect the service or participants. Material decisions are recorded in the internal moderation history.",
      "You can report a concern through the signed-in Contact form. The form is not an emergency service and should not be used for urgent threats or situations requiring local emergency support.",
    ],
  },
  {
    id: "changes",
    heading: "7. Changes to these terms",
    paragraphs: [
      "We may update these Terms when the service, legal context, or safety requirements change. Routine updates do not interrupt existing users. If a material update requires fresh acknowledgement, the platform will present the updated version before it is relied upon for the relevant use.",
      `Current version: Terms of Use v${LEGAL_DOCUMENTS.terms.version}, effective ${LEGAL_DOCUMENTS.terms.effectiveDate}.`,
    ],
  },
];

export const COMMUNITY_SECTIONS: readonly LegalSection[] = [
  {
    id: "purpose",
    heading: "A learning community built on good faith",
    paragraphs: [
      "EconMind OS brings together students, schools, educators, and independent contributors around economics learning. Participate with curiosity, evidence, and respect for the people who share the space with you.",
    ],
  },
  {
    id: "expectations",
    heading: "What we expect",
    bullets: [
      "Challenge claims, not people. Explain disagreement with evidence and reasoning.",
      "Protect personal information. Do not post or redistribute someone else's contact details, account information, or private work.",
      "Give credit for ideas, sources, and contributions. Do not pass off another person's work as your own.",
      "Use school, team, and role authority responsibly. Do not pressure others into sharing personal information or taking actions outside their permissions.",
      "Keep simulations and challenges in their educational context. Do not use them to target, harass, stereotype, or exclude real people or communities.",
    ],
  },
  {
    id: "report",
    heading: "How to raise a concern",
    paragraphs: [
      "Use the signed-in Contact form to report a conduct, safety, privacy, or integrity concern. Include enough context for an administrator to understand the issue, but do not add unnecessary sensitive information. You can follow the request from your Profile page.",
    ],
  },
  {
    id: "response",
    heading: "How the platform responds",
    paragraphs: [
      "Reports are reviewed by platform administrators. Outcomes depend on the context and may include a response, guidance, content or feature restriction, record correction, or another proportionate action. We do not promise a particular outcome, but we do record material administrative actions for accountability.",
    ],
  },
];

export const INTEGRITY_SECTIONS: readonly LegalSection[] = [
  {
    id: "principle",
    heading: "Reasoning before answers",
    paragraphs: [
      "EconMind OS values transparent reasoning, source awareness, and honest collaboration. A score, a chart, or a completed simulation is useful only when it represents the work actually done and the assumptions actually chosen.",
    ],
  },
  {
    id: "work",
    heading: "Academic and challenge integrity",
    bullets: [
      "Submit your own reasoning and identify collaborators when a task is collaborative.",
      "Use sources responsibly and distinguish evidence from assumptions, interpretations, and generated calculations.",
      "Do not alter, fabricate, or conceal model inputs, results, timestamps, team membership, official attempts, or evidence to obtain an advantage.",
      "Follow any stated attempt limit, scenario rule, and team-authority boundary. Do not coordinate to bypass a challenge's intended conditions.",
      "Treat ghost strategies, shared reports, and other released work as learning material, not as content to copy into a current official attempt without attribution or permission.",
    ],
  },
  {
    id: "review",
    heading: "Review and correction",
    paragraphs: [
      "If an integrity concern affects a challenge, project, or shared record, a platform administrator may review the relevant activity record and take a proportionate action. This can include clarification, correction, removal from a released view, invalidation of an official attempt, or a temporary feature restriction. Affected users may submit context through the Contact form.",
    ],
  },
];
