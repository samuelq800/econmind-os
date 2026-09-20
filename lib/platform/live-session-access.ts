import type { AppRole } from "@/lib/experiments/types";
import type { LeaguePlatformRole } from "@/lib/league/types";

/** Account-level authority to create and list a Live World or Live Auction room. */
export function canHostLiveSession(role: AppRole, platformRole: LeaguePlatformRole | null) {
  return role === "teacher" || platformRole === "school_leader" || platformRole === "platform_admin";
}
