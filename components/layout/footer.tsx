import Link from "next/link";

const majorLinks = [{ href: "/", label: "Home" }, { href: "/explore", label: "Explore" }, { href: "/league", label: "League" }, { href: "/research", label: "Evidence" }, { href: "/dashboard", label: "Dashboard" }];
const toolLinks = [{ href: "/daily-brief", label: "Daily Brief" }, { href: "/models", label: "Models" }, { href: "/sandbox", label: "Sandbox" }, { href: "/cases", label: "Cases" }];

export function Footer() {
  return <footer className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-10 text-sm sm:px-8 lg:px-12"><div className="mx-auto grid max-w-[1560px] gap-8 md:grid-cols-[1.5fr_1fr_1fr]"><div><p className="font-extrabold tracking-[-.03em]">EconMind OS</p><p className="mt-3 max-w-sm text-xs leading-6 text-[var(--ink-muted)]">An interactive economics laboratory for disciplined reasoning from real-world questions to models, simulations and evidence.</p></div><FooterLinks label="Platform" links={majorLinks} /><FooterLinks label="Explore" links={toolLinks} /></div><div className="mx-auto mt-10 flex max-w-[1560px] flex-col justify-between gap-3 border-t border-[var(--line)] pt-5 text-[11px] text-[var(--ink-faint)] sm:flex-row"><p>© 2026 EconMind OS. Built for economic intuition.</p><p>Models are simplified educational representations, not forecasts.</p></div></footer>;
}

function FooterLinks({ label, links }: { label: string; links: readonly { href: string; label: string }[] }) {
  return <div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--ink-faint)]">{label}</p><div className="mt-3 grid gap-2">{links.map((link) => <Link key={link.href} href={link.href} className="text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--accent)]">{link.label}</Link>)}</div></div>;
}
