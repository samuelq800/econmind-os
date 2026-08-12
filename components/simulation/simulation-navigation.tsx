"use client";

import Link from "next/link";
import { CirclePlay, Globe2, History, House } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/simulation", label: "Simulation Home", icon: House, match: (path: string) => path === "/simulation" || path === "/simulation/" },
  { href: "/simulation/world", label: "12-Country World", icon: Globe2, match: (path: string) => path.startsWith("/simulation/world") },
  { href: "/simulation/arena", label: "Simulation Arena", icon: CirclePlay, match: (path: string) => path.startsWith("/simulation/arena") },
  { href: "/simulation/arena/time-machine-1973-oil-shock", label: "1973 Oil Shock", icon: History, match: (path: string) => path.startsWith("/simulation/arena/time-machine-1973-oil-shock") },
] as const;

export function SimulationNavigation() {
  const pathname = usePathname() ?? "";
  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)]">
      <nav aria-label="Simulation navigation" className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-5 py-2 text-xs font-bold sm:px-8 lg:px-12">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}><Icon size={14} /> {label}</Link>;
        })}
      </nav>
    </div>
  );
}
