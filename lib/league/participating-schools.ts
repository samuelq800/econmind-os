export type ParticipatingSchool = {
  name: string;
  city: string;
  region: "East China" | "North China" | "South China" | "West China" | "Central China" | "International" | "League partner";
};

// This is the public editorial roster. It deliberately lives separately from
// the approval workflow in Supabase: the public page is available on static
// GitHub Pages, while school membership and League permissions remain database
// controlled. A future sync can map these labels to approved school records.
export const PARTICIPATING_SCHOOLS: readonly ParticipatingSchool[] = [
  { name: "Suzhou High School-International Division", city: "Suzhou", region: "East China" },
  { name: "BASIS Bilingual School Shenzhen", city: "Shenzhen", region: "South China" },
  { name: "Basis International School Shenzhen", city: "Shenzhen", region: "South China" },
  { name: "Beijing Academy International Department", city: "Beijing", region: "North China" },
  { name: "Beijing Aidi International School", city: "Beijing", region: "North China" },
  { name: "The High School Affiliated to Beijing Normal University", city: "Beijing", region: "North China" },
  { name: "Chongqing Nankai Secondary School", city: "Chongqing", region: "West China" },
  { name: "Hangzhou Dingwen Academy", city: "Hangzhou", region: "East China" },
  { name: "Harrow Nanning", city: "Nanning", region: "South China" },
  { name: "HD Shanghai School", city: "Shanghai", region: "East China" },
  { name: "HT Nanjing Impact Academy", city: "Nanjing", region: "East China" },
  { name: "International Department of Beijing No.80 High School", city: "Beijing", region: "North China" },
  { name: "The Attached Middle School To Jiangxi Normal University", city: "Nanchang", region: "Central China" },
  { name: "Jiangsu Tianyi High School", city: "Wuxi", region: "East China" },
  { name: "Nanjing Foreign Language School, Xianlin Campus", city: "Nanjing", region: "East China" },
  { name: "Shandong Experimental High School", city: "Jinan", region: "East China" },
  { name: "Suzhou Industrial Park Xinghai Experimental Senior High School", city: "Suzhou", region: "East China" },
  { name: "SUZHOU SCIENCE&TECHNOLOGY TOWN FOREIGN LANGUAGE SCHOOL", city: "Suzhou", region: "East China" },
  { name: "Suzhou No.1 High School", city: "Suzhou", region: "East China" },
  { name: "Chengdu Jiaxiang Foreign Language School", city: "Chengdu", region: "West China" },
  { name: "The Experimental School Affiliated with Zhuhai No.1 High School", city: "Zhuhai", region: "South China" },
  { name: "Victoria World Academy", city: "Singapore", region: "International" },
  { name: "Beijing National Day School", city: "Beijing", region: "North China" },
  { name: "HD Ningbo School", city: "Ningbo", region: "East China" },
  { name: "International Department of The Affliated High School of South Normal University", city: "League partner", region: "League partner" },
  { name: "MalvernCollegeQingdao", city: "Qingdao", region: "East China" },
  { name: "Shenzhen College of International Education", city: "Shenzhen", region: "South China" },
  { name: "杭州西子实验学校国际部", city: "Hangzhou", region: "East China" },
];

export const PARTICIPATING_SCHOOL_COUNT = PARTICIPATING_SCHOOLS.length;

function normaliseSchoolName(name: string) {
  return name.toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

// These aliases were reviewed as one school identity. The public directory
// preserves the registered record and its Teams, while presenting its agreed
// canonical school name everywhere a roster is shown.
const SCHOOL_NAME_ALIASES: Readonly<Record<string, string>> = {
  baid: "beijingacademyinternationaldepartment",
  "南外仙林分校": "nanjingforeignlanguageschoolxianlincampus",
  "苏州一中": "suzhouno1highschool",
  suzhouscientificforeignlanguagehighschool: "suzhousciencetechnologytownforeignlanguageschool",
};

export function participatingSchoolKey(name: string) {
  const normalised = normaliseSchoolName(name);
  return SCHOOL_NAME_ALIASES[normalised] ?? normalised;
}
