import { LeagueDashboardPage } from "@/components/league/league-dashboard-page";

export default function SimulationDashboardPage() {
  return <LeagueDashboardPage paths={{ quickChallenge: "/simulation/quick-challenge", join: "/simulation/join", arena: "/simulation/arena" }} />;
}
