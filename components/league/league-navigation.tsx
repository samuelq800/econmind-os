"use client";

import Link from "next/link";
import { Building2, CalendarDays, GraduationCap, House, Info, LayoutDashboard, Trophy, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const items = [
  { href: "/league", label: "Home", icon: House, match: (path: string) => path === "/league" || path === "/league/" },
  { href: "/league/schools", label: "Schools", icon: Building2, match: (path: string) => path.startsWith("/league/schools") },
  { href: "/league/teams", label: "Teams", icon: UsersRound, match: (path: string) => path.startsWith("/league/teams") },
  { href: "/league/season", label: "Season", icon: CalendarDays, match: (path: string) => path.startsWith("/league/season") || path.startsWith("/league/arena") },
  { href: "/league/standings", label: "Standings", icon: Trophy, match: (path: string) => path.startsWith("/league/standings") },
  { href: "/league/about", label: "About", icon: Info, match: (path: string) => path.startsWith("/league/about") },
];

/** Core League navigation intentionally presents the organisation, not the simulations. */
export function LeagueNavigation() {
  const { worldSupervisor, roleLoading } = useAuth();
  const pathname = usePathname() ?? "";

  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)]">
      <nav aria-label="League navigation" className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-5 py-2 text-xs font-bold sm:px-8 lg:px-12">
        <Link href="/league" className="mr-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[var(--accent)] hover:bg-[var(--accent-soft)]">
          <GraduationCap size={15} /> EconMind League
        </Link>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--line)]" />
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}>
              <Icon size={14} /> {label}
            </Link>
          );
        })}
        {!roleLoading && worldSupervisor && <Link href="/league/dashboard" className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"><LayoutDashboard size={14} /> Admin</Link>}
      </nav>
    </div>
  );
}
