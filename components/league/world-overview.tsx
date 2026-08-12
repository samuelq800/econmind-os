import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, Globe2, Network, Wheat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TWELVE_COUNTRY_TEMPLATES } from "@/lib/economics/world";

export function TwelveNationWorldOverview({ compact = false, target = "/league/world" }: { competitionId?: string; compact?: boolean; target?: string }) {
  return <Card className={`relative overflow-hidden border-[var(--accent)] ${compact ? "p-5" : "p-6 sm:p-8"}`}>
    <div className="absolute inset-0 page-grid opacity-25" />
    <div className="relative flex flex-wrap items-start justify-between gap-5">
      <div><Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">Simulation World · 12 countries</Badge><h2 className="mt-3 text-2xl font-bold tracking-[-.04em]">Interconnected World Economy</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Twelve balanced fictional economies trade energy, food, manufactured goods and technology services. Select a country to inspect its public structure.</p></div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2"><strong className="block text-base text-[var(--accent)]">12</strong>countries</span><span className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2"><strong className="block text-base text-[var(--accent)]">4</strong>markets</span><span className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2"><strong className="block text-base text-[var(--accent)]">48</strong>roles</span></div>
    </div>
    <div className={`relative mt-6 grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"}`}>
      {TWELVE_COUNTRY_TEMPLATES.map((country) => <Link key={country.id} href={target} className="group min-w-0 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"><div className="flex items-center gap-2"><Image src={country.config.visualIdentity.flag} alt={country.config.visualIdentity.alt} width={36} height={22} className="h-6 w-9 rounded object-cover" /><span className="min-w-0"><span className="block truncate text-xs font-bold">{country.name}</span><span className="block text-[10px] font-bold tracking-[.12em] text-[var(--ink-faint)]">{country.config.shortCode}</span></span></div><p className="mt-3 truncate text-[11px] font-medium text-[var(--ink-muted)]">{country.config.primarySpecialisation}</p><div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--ink-faint)]"><span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: country.config.visualIdentity.primary }} /> Balance {country.balanceScore}</div></Link>)}
    </div>
    {!compact && <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5"><div className="flex flex-wrap gap-3 text-xs text-[var(--ink-muted)]"><span className="inline-flex items-center gap-1"><Globe2 size={14} /> Shared price clearing</span><span className="inline-flex items-center gap-1"><Network size={14} /> Configurable trade links</span><span className="inline-flex items-center gap-1"><Wheat size={14} /> Food resilience</span><span className="inline-flex items-center gap-1"><Box size={14} /> No commodity monopoly</span></div><Link href={target} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">Open World Dashboard <ArrowRight size={15} /></Link></div>}
  </Card>;
}
