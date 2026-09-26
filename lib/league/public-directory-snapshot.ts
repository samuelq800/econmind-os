import snapshot from "@/lib/league/public-directory-snapshot.json";
import type { PublicLeagueSchool } from "@/lib/supabase/league-directory";

// Refreshed immediately before every Pages export. This public snapshot is
// rendered into HTML so non-JavaScript readers see the approved directory too.
export const publicDirectorySnapshot = snapshot.schools as PublicLeagueSchool[];
export const publicDirectorySnapshotUpdatedAt = snapshot.generatedAt;
