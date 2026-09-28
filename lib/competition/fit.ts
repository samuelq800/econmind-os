/** Explanatory, opt-in skill complementarity only. Never considers grades or scores. */
export function competitionFit(
  offered: string[],
  requested: string[],
  preferredCurriculum = "any",
  actualCurriculum = "",
) {
  const wanted = new Set(
    requested.map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  const seen = new Set<string>();
  const overlap = offered
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!wanted.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const curriculumMatch =
    preferredCurriculum !== "any" &&
    preferredCurriculum.toLowerCase() === actualCurriculum.toLowerCase();
  return {
    score: Math.min(95, 48 + overlap.length * 14 + (curriculumMatch ? 8 : 0)),
    reasons: [
      ...(overlap.length
        ? overlap.map((value) => `${value} aligns with this team's needs`)
        : [
            "Same competition and division",
            "Explore the profile to assess fit",
          ]),
      ...(curriculumMatch
        ? [`${actualCurriculum} matches the preferred curriculum`]
        : []),
    ],
  };
}
