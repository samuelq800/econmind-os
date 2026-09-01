"use client";

import Link from "next/link";
import { CirclePlay, FlaskConical, Globe2, History, House, LayoutDashboard, MapPinned, Scale, Target, Trophy } from "lucide-react";
import { usePathname } from "next/navigation";
import { SIMULATION_NAVIGATION_ITEMS, type SimulationNavigationIcon } from "@/lib/platform/simulation-navigation";

const navigationIcons: Record<SimulationNavigationIcon, typeof House> = {
  home: House, world: Globe2, challenge: Target, command: FlaskConical, competition: Trophy,
  arena: CirclePlay, history: History, scenario: MapPinned, battle: Scale, dashboard: LayoutDashboard,
};

export function SimulationNavigation() {
  const pathname = usePathname() ?? "";
  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)]">
      <nav aria-label="Simulation navigation" className="scroll-rail mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-5 py-2 text-xs font-bold sm:px-8 lg:px-12">
        {SIMULATION_NAVIGATION_ITEMS.map(({ href, label, icon, match }) => {
          const Icon = navigationIcons[icon];
          const active = match(pathname);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}><Icon size={14} /> {label}</Link>;
        })}
      </nav>
    </div>
  );
}
