import Link from "next/link";
import type { ReactNode } from "react";
import { Season1PolicyLinks } from "@/components/legal/season1-policy-links";

export function Season1WorkspaceNav({
  active,
  children,
  preview = false,
}: {
  active: "lobby" | "team" | "countries";
  children?: ReactNode;
  preview?: boolean;
}) {
  return (
    <><nav
      aria-label="Season 1"
      className="mb-8 flex flex-wrap items-center gap-3 text-sm font-bold"
    >
      {[
        { id: "lobby", href: "/season1", label: "Season 1 Lobby" },
        { id: "team", href: "/season1/my-team", label: "My Team" },
        {
          id: "countries",
          href: preview ? "/season1/countries/preview" : "/season1/countries",
          label: "Country Selection",
        },
      ].map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={
            active === item.id
              ? "rounded-lg bg-[var(--accent-soft)] px-4 py-2 text-[var(--accent)]"
              : "rounded-lg border border-[var(--line)] px-4 py-2 hover:bg-[var(--surface-subtle)]"
          }
        >
          {item.label}
        </Link>
      ))}
      {children}
    </nav><Season1PolicyLinks /></>
  );
}
