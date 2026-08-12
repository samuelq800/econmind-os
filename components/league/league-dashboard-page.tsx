"use client";

import { LeagueDashboard } from "./league-dashboard";
import { AdminCommandCentreStats } from "./admin-command-centre-stats";

export function LeagueDashboardPage({
  paths,
}: {
  paths?: { quickChallenge: string; join: string; arena: string };
} = {}) {
  return <><LeagueDashboard paths={paths} /><AdminCommandCentreStats /></>;
}
