import Link from "next/link";
import { ArrowRight, BookOpen, Landmark, Newspaper } from "lucide-react";

const destinations = [
  {
    href: "/daily-brief",
    icon: Newspaper,
    eyebrow: "Real-world economics",
    title: "Daily Brief",
    description: "Follow current economic developments and connect each brief to the models used to explain it.",
  },
  {
    href: "/cases",
    icon: Landmark,
    eyebrow: "Applied learning",
    title: "Real-World Cases",
    description: "Work through economic problems, constraints and policy choices without affecting the fictional World Economy.",
  },
  {
    href: "/cases/history",
    icon: BookOpen,
    eyebrow: "Context and evidence",
    title: "Historical Crises",
    description: "Review historical cases and trace the mechanisms that link shocks, policies and outcomes.",
  },
] as const;

export default function ExplorePage() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12">
      <header className="max-w-3xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">Learning & research</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Explore economics in context.</h1>
        <p className="mt-5 text-base leading-7 text-[var(--ink-muted)]">Real-world information, cases and historical context remain separate from the fictional, persistent World Economy simulation.</p>
      </header>
      <section className="mt-10 grid gap-4 lg:grid-cols-3" aria-label="Explore destinations">
        {destinations.map(({ href, icon: Icon, eyebrow, title, description }) => (
          <Link key={href} href={href} className="group flex min-h-64 flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={19} /></span>
            <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--ink-faint)]">{eyebrow}</p>
            <h2 className="mt-2 text-xl font-bold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
            <span className="mt-auto flex items-center gap-2 pt-8 text-xs font-bold text-[var(--accent)]">Open <ArrowRight size={14} /></span>
          </Link>
        ))}
      </section>
    </main>
  );
}
