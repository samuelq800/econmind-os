import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";

type FeatureUnavailableProps = {
  area: string;
  title: string;
  description: string;
  availableNow: { href: string; label: string }[];
};

export function FeatureUnavailable({ area, title, description, availableNow }: FeatureUnavailableProps) {
  return (
    <main className="mx-auto max-w-[880px] px-5 py-16 sm:px-8 lg:py-24">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[var(--shadow)] sm:p-10">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--amber-soft)] text-[var(--amber)]"><LockKeyhole size={20} /></span>
        <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--ink-faint)]">{area}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">{description}</p>
        <p className="mt-4 max-w-2xl rounded-lg bg-[var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[var(--ink-muted)]">This route is reserved for the complete feature. It is not presented as a working simulation until its authored content, permissions and calculation rules are ready.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {availableNow.map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line-strong)] px-4 text-xs font-bold transition hover:bg-[var(--surface-subtle)]">
              {item.label} <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
