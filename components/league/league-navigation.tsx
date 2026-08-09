"use client";

import Link from "next/link";
import { Archive, ArrowLeft, CirclePlay, LayoutDashboard, Trophy, UsersRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const items = [
  { href: "/league", label: "League Home", icon: ArrowLeft, accent: true },
  { href: "/league/arena", label: "Simulation Arena", icon: CirclePlay },
  { href: "/league/teams", label: "My Teams", icon: UsersRound },
  { href: "/league/standings", label: "Standings", icon: Trophy },
  { href: "/league/replay", label: "Replay", icon: Archive },
];

/** The compact League-only navigation deliberately leaves feature links inside their relevant pages. */
export function LeagueNavigation() {
  const { worldSupervisor, roleLoading } = useAuth();
  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)]">
      <nav aria-label="League navigation" className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-5 py-2 text-xs font-bold sm:px-8 lg:px-12">
        {items.map(({ href, label, icon: Icon, accent }) => (
          <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 ${accent ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}>
            <Icon size={14} /> {label}
          </Link>
        ))}
        {!roleLoading && worldSupervisor && <Link href="/league/dashboard" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"><LayoutDashboard size={14} /> Admin</Link>}
      </nav>
    </div>
  );
}
