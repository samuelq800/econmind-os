import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_CONTACT_MAILTO } from "@/lib/platform/contact";

type HubItem = {
  href: string;
  label: string;
  description: string;
  note?: string;
};

export function LegalHub({
  eyebrow,
  title,
  summary,
  items,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  items: readonly HubItem[];
}) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-5xl">{title}</h1>
        <p className="mt-5 text-base leading-8 text-[var(--ink-muted)]">{summary}</p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2" aria-label={`${title} resources`}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]">
            <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-bold tracking-[-.03em]">{item.label}</h2><ArrowUpRight className="shrink-0 text-[var(--accent)]" size={19} /></div>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{item.description}</p>
            {item.note && <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--ink-faint)]">{item.note}</p>}
          </Link>
        ))}
      </section>

      <p className="mt-8 border-t border-[var(--line)] pt-5 text-sm leading-7 text-[var(--ink-muted)]">
        General enquiries or sign-in access support: <a href={OFFICIAL_CONTACT_MAILTO} className="font-bold text-[var(--accent)] hover:underline">{OFFICIAL_CONTACT_EMAIL}</a>. For requests involving private records, account deletion, or an appeal, use the signed-in Contact form so the request can be handled securely.
      </p>
    </main>
  );
}
