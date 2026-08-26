"use client";

import { Database, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SchoolLocationCatalogEntry } from "@/lib/league/geographic-areas";

export function ExistingLocationMatch({
  entry,
  busy,
  canUse,
  onUse,
  onEdit,
}: {
  entry: SchoolLocationCatalogEntry;
  busy: boolean;
  canUse: boolean;
  onUse: () => void;
  onEdit: () => void;
}) {
  const place = [entry.city, entry.administrativeArea, entry.areaLabel].filter(Boolean).join(" · ");

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)]" role="region" aria-label="Existing canonical place">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--amber)] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Database className="mt-0.5 shrink-0 text-[var(--amber-strong)]" size={16} aria-hidden="true" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.1em]">Existing canonical place</p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">
              This GeoNames ID is already frozen in the verified directory. Reuse it instead of overwriting its canonical fields.
            </p>
          </div>
        </div>
        <a
          href={`https://www.geonames.org/${entry.geonameId}/`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent)]"
        >
          Open GeoNames <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-bold">{place}</p>
        <dl className="mt-3 grid gap-3 text-[10px] sm:grid-cols-3">
          <div>
            <dt className="font-bold uppercase tracking-[.08em] text-[var(--ink-faint)]">GeoNames ID</dt>
            <dd className="mt-1 font-mono text-[var(--ink)]">{entry.geonameId}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-[.08em] text-[var(--ink-faint)]">City-centre coordinates</dt>
            <dd className="mt-1 font-mono text-[var(--ink)]">{entry.latitude}, {entry.longitude}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-[.08em] text-[var(--ink-faint)]">Catalog key</dt>
            <dd className="mt-1 font-mono text-[var(--ink)]">{entry.locationKey}</dd>
          </div>
        </dl>
        {!canUse && (
          <p className="mt-3 text-[10px] leading-4 text-[var(--ink-muted)]">
            Add a valid independent school or institutional evidence URL above before reusing this record.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" type="button" disabled={busy || !canUse} onClick={onUse}>Use catalog record</Button>
          <Button size="sm" type="button" variant="ghost" disabled={busy} onClick={onEdit}>Edit entered values</Button>
        </div>
      </div>
    </div>
  );
}
