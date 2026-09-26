export type PreferenceCategory =
  "area" | "economics" | "activity" | "skill" | "collaboration" | "research";
export type MemberIdentity = {
  displayName: string | null;
  avatarUrl: string | null;
  bio: string;
  grade: string;
  graduationYear: number | null;
  clubName: string | null;
  leaguePreference: "participant" | "team_lead" | "school_liaison" | null;
  memberSince: string | null;
};
export type MemberProfile = {
  userId: string;
  identity: MemberIdentity;
  school: {
    id: string;
    name: string;
    logoUrl: string | null;
    city: string | null;
    area: string | null;
    status: string;
  } | null;
  schoolChangeGuard: "leader" | "league-team" | null;
  roles: { label: string; context: string | null; href: string }[];
  options: { category: PreferenceCategory; key: string; label: string }[];
  choices: { category: PreferenceCategory; key: string; primary: boolean }[];
  activity: {
    season1: {
      teamId: string;
      teamName: string;
      teamStatus: string;
      memberRole: string;
      rolePreferences: string[] | null;
      joinedAt: string;
    } | null;
    research: { submissions: number; publications: number } | null;
    liveRoomsHosted: number | null;
  };
};
export function preferenceLabels(
  profile: MemberProfile,
  category: PreferenceCategory,
) {
  return profile.choices
    .filter((choice) => choice.category === category)
    .map((choice) => ({
      ...choice,
      label:
        profile.options.find(
          (option) => option.category === category && option.key === choice.key,
        )?.label ?? choice.key,
    }));
}
export function safeImageUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function memberDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
