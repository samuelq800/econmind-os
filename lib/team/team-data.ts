export type TeamContact = {
  type: "phone" | "wechat";
  value: string;
};

export type TeamMember = {
  name: string;
  role: string;
  focus?: readonly string[];
  image?: string;
  imagePosition?: string;
  contact: TeamContact;
};

export const FOUNDING_TEAM: readonly TeamMember[] = [
  {
    name: "Samuel",
    role: "Co-Founder",
    focus: ["Product", "Economic Simulation", "Academic Development"],
    image: "/images/team/samuel-yale.jpg",
    imagePosition: "50% 45%",
    contact: { type: "phone", value: "13862162460" },
  },
  {
    name: "Yale",
    role: "Co-Founder",
    focus: ["Research", "League Development", "Partnerships"],
    image: "/images/team/samuel-yale.jpg",
    imagePosition: "50% 45%",
    contact: { type: "wechat", value: "huhuhu20100220" },
  },
];

export const REGIONAL_LEADERS: readonly TeamMember[] = [
  {
    name: "Angela",
    role: "East China & National A-Level Lead",
    image: "/images/team/angela.jpg",
    imagePosition: "50% 34%",
    contact: { type: "wechat", value: "iCambridge8" },
  },
  {
    name: "Aria",
    role: "International Relations Lead",
    image: "/images/team/aria.jpg",
    imagePosition: "67% 42%",
    contact: { type: "phone", value: "18222323717" },
  },
  {
    name: "Clement",
    role: "Jiangsu Regional Lead",
    image: "/images/team/clement.jpg",
    imagePosition: "50% 32%",
    contact: { type: "phone", value: "15366172515" },
  },
  {
    name: "Emma",
    role: "Beijing Regional Lead",
    image: "/images/team/emma.jpg",
    imagePosition: "50% 43%",
    contact: { type: "phone", value: "18516920862" },
  },
  {
    name: "Ivy",
    role: "South China Regional Lead",
    image: "/images/team/ivy.jpg",
    imagePosition: "50% 48%",
    contact: { type: "wechat", value: "forgetmenot410" },
  },
  {
    name: "Jessie",
    role: "Jiangxi Regional Lead",
    contact: { type: "wechat", value: "JessieZhang0501" },
  },
  {
    name: "Rae",
    role: "Shandong Regional Lead",
    image: "/images/team/rae.jpg",
    imagePosition: "50% 38%",
    contact: { type: "wechat", value: "zrm091511" },
  },
  {
    name: "Richard",
    role: "East China & National A-Level Lead",
    image: "/images/team/richard.jpg",
    imagePosition: "50% 40%",
    contact: { type: "wechat", value: "HHR_0211" },
  },
  {
    name: "Sophia Cai",
    role: "Zhejiang Regional Lead",
    image: "/images/team/sophia-cai.jpg",
    imagePosition: "50% 34%",
    contact: { type: "wechat", value: "Sophialonglive" },
  },
  {
    name: "Sophia Liu",
    role: "Beijing Regional Lead",
    image: "/images/team/sophia.jpg",
    imagePosition: "50% 46%",
    contact: { type: "phone", value: "18210253060" },
  },
  {
    name: "Trione",
    role: "Southwest China Regional Lead",
    image: "/images/team/trione.jpg",
    imagePosition: "50% 38%",
    contact: { type: "phone", value: "18996390101" },
  },
];

export const REGIONAL_NETWORK = [
  { region: "Beijing", leads: ["Emma", "Sophia Liu"] },
  { region: "Zhejiang", leads: ["Sophia Cai"] },
  { region: "Shandong", leads: ["Rae"] },
  { region: "Jiangsu", leads: ["Clement"] },
  { region: "Jiangxi", leads: ["Jessie"] },
  { region: "East China & National A-Level", leads: ["Angela", "Richard"] },
  { region: "Southwest China", leads: ["Trione"] },
  { region: "South China", leads: ["Ivy"] },
  { region: "International", leads: ["Aria"] },
] as const;

export function contactLabel(contact: TeamContact) {
  return contact.type === "phone" ? "Phone" : "WeChat";
}
