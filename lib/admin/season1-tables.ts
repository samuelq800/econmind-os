import type { Season1AdminOverview } from "@/lib/supabase/season1-admin";
import type { PageTable } from "./page-tables";

/** Flatten only the already-authorized, complete admin snapshot. Never participant discovery cards. */
export function season1Tables(view: Season1AdminOverview): PageTable[] {
  const identity = { seasonId: view.seasonId, snapshotAt: view.snapshotAt };
  const sourceColumns = [
    { key: "seasonId", label: "Season ID" },
    { key: "snapshotAt", label: "Snapshot (UTC)" },
  ];
  return [
    {
      id: "teams",
      title: "Teams",
      filename: "econmind-season1-teams.csv",
      description:
        "All current Season 1 teams, including full and locked teams. Dissolved teams are excluded.",
      columns: [
        { key: "name", label: "Team" },
        { key: "code", label: "Team code" },
        { key: "captain", label: "Captain" },
        { key: "captainUserId", label: "Captain user ID" },
        { key: "schoolName", label: "Home school" },
        { key: "memberSchools", label: "Member schools" },
        { key: "memberCount", label: "Members" },
        { key: "capacity", label: "Capacity" },
        { key: "readyCount", label: "Ready" },
        { key: "status", label: "Status" },
        { key: "recruiting", label: "Recruiting" },
        { key: "recruitmentLocked", label: "Recruitment locked" },
        { key: "recruitmentMode", label: "Recruitment mode" },
        { key: "applicationCount", label: "Pending applications" },
        { key: "teamStyle", label: "Team style" },
        { key: "preferredLanguage", label: "Language" },
        { key: "description", label: "Description" },
        { key: "focus", label: "Focus" },
        { key: "createdAt", label: "Created (UTC)" },
        { key: "id", label: "Team ID" },
        ...sourceColumns,
      ],
      rows: view.teams.map(({ members, ...team }) => ({
        ...team,
        ...identity,
        captain: members.find((member) => member.memberRole === "captain")
          ?.displayName,
        captainUserId: members.find((member) => member.memberRole === "captain")
          ?.userId,
        memberSchools: [
          ...new Set(
            members.map((member) => member.schoolName).filter(Boolean),
          ),
        ].join("; "),
      })),
    },
    {
      id: "members",
      title: "Members",
      filename: "econmind-season1-members.csv",
      description:
        "Every member of every current team, not only the signed-in administrator’s team. Free agents are counted in the summary but are not team members.",
      columns: [
        { key: "teamName", label: "Team" },
        { key: "teamCode", label: "Team code" },
        { key: "displayName", label: "Member" },
        { key: "schoolName", label: "School" },
        { key: "memberRole", label: "Membership role" },
        { key: "rolePreferences", label: "Role preferences" },
        { key: "isReady", label: "Ready" },
        { key: "joinedAt", label: "Joined (UTC)" },
        { key: "userId", label: "User ID" },
        { key: "teamId", label: "Team ID" },
        ...sourceColumns,
      ],
      rows: view.teams.flatMap((team) =>
        team.members.map((member) => ({
          ...member,
          ...identity,
          teamId: team.id,
          teamName: team.name,
          teamCode: team.code,
          rolePreferences: member.rolePreferences.join("; "),
        })),
      ),
    },
    {
      id: "summary",
      title: "Summary",
      filename: "econmind-season1-summary.csv",
      description:
        "Counts from the same server snapshot as the full team and member tables. Platform accounts are not concurrent visitors.",
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
        { key: "definition", label: "Definition" },
        ...sourceColumns,
      ],
      rows: [
        [
          "Season 1 participants",
          view.stats.participants,
          "Distinct members of current teams plus available free agents",
        ],
        [
          "Teams",
          view.stats.teams,
          "Current Season 1 teams, excluding dissolved teams",
        ],
        ["In teams", view.stats.teamMembers, "Current team membership rows"],
        [
          "Free agents",
          view.stats.freeAgents,
          "Available listings excluding people already in a team",
        ],
        [
          "Ready members",
          view.stats.readyMembers,
          "Current members marked ready",
        ],
        [
          "Platform accounts",
          view.stats.registeredPlayers,
          "All active registered profiles, not online visitors",
        ],
      ].map(([metric, value, definition]) => ({
        metric,
        value,
        definition,
        ...identity,
      })),
    },
  ];
}
