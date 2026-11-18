/** Category and subtype labels are navigation, independent of private wording. */
export const CREDENTIAL_CATEGORIES = [
  {
    "code": "MEM",
    "label": "Membership",
    "subtypes": [
      "Registered Member",
      "Department Member",
      "Affiliated Society Member"
    ]
  },
  {
    "code": "PAR",
    "label": "Participation",
    "subtypes": [
      "World Simulation",
      "Season 1",
      "Event Participant",
      "League Participant"
    ]
  },
  {
    "code": "CON",
    "label": "Contribution",
    "subtypes": [
      "Technical Contribution",
      "Design Coordination",
      "Multi-platform Communications",
      "Video Production & Editing",
      "WeChat Official Account",
      "Douyin Publicity",
      "Academic Contribution",
      "Communications Contribution",
      "Operational Contribution",
      "Research Authorship · Live Library"
    ]
  },
  {
    "code": "LEA",
    "label": "Leadership",
    "subtypes": [
      "Initial Founder",
      "Co-founder",
      "Regional Lead",
      "Department Lead",
      "School Society President",
      "Leadership Group Member",
      "Department Head",
      "Project Lead",
      "Society President",
      "Founder Team Member"
    ]
  },
  {
    "code": "SUP",
    "label": "Supervisor",
    "subtypes": [
      "Supervisor"
    ]
  },
  {
    "code": "CLB",
    "label": "School Econ / Business Club",
    "subtypes": [
      "Economics Club",
      "Business Club",
      "Affiliated Club"
    ]
  },
  {
    "code": "DIS",
    "label": "Distinction",
    "subtypes": [
      "Outstanding Academic Contribution",
      "Research Excellence",
      "Outstanding Technical Development",
      "Economic Simulation Innovation",
      "Platform Engineering Excellence",
      "Outstanding Communications Achievement",
      "Digital Media Excellence",
      "Editorial Excellence",
      "Official Badge Design",
      "Brand Identity Development",
      "Official Certificate Design",
      "Outstanding Organizational Contribution",
      "School Network Development",
      "Leadership Excellence",
      "Outstanding Community Impact",
      "Interdisciplinary Collaboration Excellence",
      "Project Excellence",
      "Outstanding Contribution",
      "Exceptional Leadership"
    ]
  },
  {
    "code": "PRT",
    "label": "Partner",
    "subtypes": [
      "Partner"
    ]
  },
  {
    "code": "GSP",
    "label": "Guest Speaker",
    "subtypes": [
      "Guest Speaker"
    ]
  }
];
export type CategoryCode = "MEM" | "PAR" | "CON" | "LEA" | "DIS" | "SUP" | "CLB" | "PRT" | "GSP";
export type WordingCatalog = {
  imported: boolean;
  presets: { template_id: string; recipient_name: string; data_mode: "personal_preset" }[];
  archive: { legacy_id: string; subtype: string; statement: string }[];
};
export const EMPTY_WORDING_CATALOG: WordingCatalog = { imported: false, presets: [], archive: [] };

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
  status: "draft" | "reviewed" | "approved" | "archived";
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
