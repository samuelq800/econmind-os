import { SimulationNavigation } from "@/components/simulation/simulation-navigation";

export default function SimulationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><SimulationNavigation />{children}</>;
}
