import { LeagueNavigation } from "@/components/league/league-navigation";

export default function LeagueLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><LeagueNavigation />{children}</>;
}
