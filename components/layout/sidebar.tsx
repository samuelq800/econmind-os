"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { MODEL_ICONS } from "@/lib/models/icons";
import { AVAILABLE_MODELS } from "@/lib/models/registry";

const models = AVAILABLE_MODELS.filter((model) => model.route.startsWith("/models/"));

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-b border-[var(--line)] bg-[var(--canvas)] md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:w-64 md:shrink-0 md:border-r md:border-b-0">
      <div className="overflow-x-auto p-3 md:p-5">
        <p className="mb-3 hidden px-2 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--ink-faint)] md:block">Model library</p>
        <nav className="flex min-w-max gap-1 md:min-w-0 md:flex-col">
          <SidebarLink href="/models" label="Overview" active={pathname === "/models"} icon={LayoutGrid} />
          {models.map((model) => (
            <SidebarLink
              key={model.slug}
              href={model.route}
              label={model.title}
              active={pathname.startsWith(model.route)}
              icon={MODEL_ICONS[model.icon]}
            />
          ))}
        </nav>
        <div className="mt-8 hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 md:block">
          <div className="mb-2 size-2 rounded-full bg-[var(--accent)]" />
          <p className="text-xs font-bold">Local calculation, private sync</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">Sliders calculate only in your browser. Supabase is contacted on deliberate account actions.</p>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ href, label, active, icon: Icon }: { href: string; label: string; active: boolean; icon: typeof LayoutGrid }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold md:text-sm ${active ? "bg-[var(--surface)] shadow-sm ring-1 ring-[var(--line)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}>
      <Icon size={16} />{label}
    </Link>
  );
}
