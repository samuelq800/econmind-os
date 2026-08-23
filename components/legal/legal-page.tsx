import Link from "next/link";
import type { LegalSection } from "@/lib/legal/legal-content";
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_CONTACT_MAILTO } from "@/lib/platform/contact";

export function LegalPage({
  eyebrow,
  title,
  summary,
  version,
  effectiveDate,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  version: string;
  effectiveDate: string;
  sections: readonly LegalSection[];
}) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
        <article className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-muted)]">{summary}</p>
          <p className="mt-5 text-xs font-semibold text-[var(--ink-faint)]">Version {version} · Effective {effectiveDate}</p>

          <div className="mt-12 space-y-11">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <h2 className="text-2xl font-bold tracking-[-.03em]">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-[var(--ink-muted)]">{paragraph}</p>)}
                {section.bullets && <ul className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-muted)]">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="mt-3 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />{bullet}</li>)}</ul>}
              </section>
            ))}
          </div>
        </article>

        <aside className="h-fit rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 lg:sticky lg:top-24">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--ink-faint)]">On this page</p>
          <nav className="mt-4 grid gap-2" aria-label="Page table of contents">
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="text-xs font-semibold leading-5 text-[var(--ink-muted)] hover:text-[var(--accent)]">{section.heading.replace(/^\d+\.\s/, "")}</a>)}
          </nav>
          <div className="mt-6 border-t border-[var(--line)] pt-5 text-xs leading-6 text-[var(--ink-muted)]">
            Need help? <Link className="font-bold text-[var(--accent)]" href="/contact">Use the secure Contact form</Link>.
            <br />
            General enquiries: <a className="font-bold text-[var(--accent)]" href={OFFICIAL_CONTACT_MAILTO}>{OFFICIAL_CONTACT_EMAIL}</a>.
          </div>
        </aside>
      </div>
    </main>
  );
}
