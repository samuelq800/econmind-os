export const CURRICULUM_SYSTEMS = ["ap", "ib", "alevel", "other"] as const;

export type CurriculumSystem = (typeof CURRICULUM_SYSTEMS)[number];

export const CURRICULUM_SYSTEM_LABELS: Record<CurriculumSystem, string> = {
  ap: "AP",
  ib: "IB",
  alevel: "A-Level",
  other: "Other / mixed curriculum",
};

export function isCurriculumSystem(value: unknown): value is CurriculumSystem {
  return typeof value === "string" && (CURRICULUM_SYSTEMS as readonly string[]).includes(value);
}
