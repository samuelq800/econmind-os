/** Categories reserve structure only. They do not create awards or approved wording. */
export const CREDENTIAL_CATEGORIES = [
  { code: "MEM", label: "Membership", subtypes: ["Registered Member", "Affiliated Society Member"] },
  { code: "PAR", label: "Participation", subtypes: ["World Simulation Participant", "Event Participant", "League Participant"] },
  { code: "CON", label: "Contribution", subtypes: ["Technical Contribution", "Academic Contribution", "Communications Contribution", "Operational Contribution"] },
  { code: "LEA", label: "Leadership", subtypes: ["Initial Founder", "Co-founder", "Leadership Group Member", "Regional Lead", "Department Head", "Project Lead", "Society President", "Founder Team Member"] },
  { code: "DIS", label: "Distinction", subtypes: ["Outstanding Contribution", "Project Excellence", "Exceptional Leadership"] },
] as const;

export type CategoryCode = (typeof CREDENTIAL_CATEGORIES)[number]["code"];
export type WordingContent = {
  title: string;
  certification_statement: string;
  role_description: string;
  contribution_paragraph: string;
  service_period_text: string;
};
export type WordingVersion = {
  id: string;
  category: CategoryCode;
  subtype: string;
  template_name: string;
  version: number;
  status: "draft" | "approved" | "archived";
  text_content: WordingContent;
  created_at: string;
};
export const BLANK_WORDING: WordingContent = {
  title: "", certification_statement: "", role_description: "", contribution_paragraph: "", service_period_text: "",
};
export const WORDING_FIELDS: { key: keyof WordingContent; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "title", label: "Certificate title", placeholder: "[Certificate Title]" },
  { key: "certification_statement", label: "Certification statement", placeholder: "[Certification Statement]", multiline: true },
  { key: "role_description", label: "Role / position text", placeholder: "[Verified Responsibilities]" },
  { key: "contribution_paragraph", label: "Contribution description", placeholder: "[Contribution Description]", multiline: true },
  { key: "service_period_text", label: "Service period text", placeholder: "[Service Period]" },
];

export function blankWording(): WordingContent { return { ...BLANK_WORDING }; }
export function wordingFrom(value: Partial<WordingContent> | null | undefined): WordingContent {
  return Object.fromEntries(Object.keys(BLANK_WORDING).map(key => [key, typeof value?.[key as keyof WordingContent] === "string" ? value[key as keyof WordingContent] : ""])) as WordingContent;
}
export function approvedWording(versions: WordingVersion[], category: string, subtype: string): WordingVersion[] {
  return versions.filter(item => item.category === category && item.subtype === subtype && item.status === "approved");
}
