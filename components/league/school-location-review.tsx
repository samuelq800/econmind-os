"use client";

import { useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, MapPinCheck, MapPinOff, TriangleAlert } from "lucide-react";
import { ExistingLocationMatch } from "@/components/league/existing-location-match";
import { EMPTY_SCHOOL_LOCATION, SchoolLocationFields } from "@/components/league/school-location-fields";
import { Button } from "@/components/ui/button";
import {
  canonicalLocationFromCatalogEntry,
  isCompleteSchoolLocation,
  isValidCoordinate,
  isValidGeonameId,
  isValidIndependentLocationEvidenceUrl,
  type CanonicalSchoolLocationInput,
  type SchoolLocationCatalogEntry,
} from "@/lib/league/geographic-areas";
import type { School } from "@/lib/league/types";

export function SchoolLocationReview({
  school,
  busy,
  onFindCatalogLocation,
  onVerify,
}: {
  school: School;
  busy: boolean;
  onFindCatalogLocation: (geonameId: number) => Promise<SchoolLocationCatalogEntry | null>;
  onVerify: (location: CanonicalSchoolLocationInput) => Promise<boolean>;
}) {
  const locationStatus = school.location_status ?? "missing";
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState({ ...EMPTY_SCHOOL_LOCATION, city: school.city ?? "" });
  const [geonameId, setGeonameId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);
  const [catalogEntry, setCatalogEntry] = useState<SchoolLocationCatalogEntry | null>(null);
  const [catalogMiss, setCatalogMiss] = useState(false);

  const geonamesSearchUrl = useMemo(() => {
    const query = [school.name, location.city, location.administrativeArea, location.areaLabel]
      .filter(Boolean)
      .join(" ");
    return `https://www.geonames.org/search.html?q=${encodeURIComponent(query)}`;
  }, [location, school.name]);

  const canVerify = isCompleteSchoolLocation(location)
    && isValidGeonameId(geonameId)
    && isValidCoordinate(latitude, -90, 90)
    && isValidCoordinate(longitude, -180, 180)
    && isValidIndependentLocationEvidenceUrl(evidenceUrl);

  async function verify() {
    if (!isValidGeonameId(geonameId)) return;
    setChecking(true);
    setCatalogMiss(false);
    try {
      const parsedGeonameId = Number(geonameId);
      const existingEntry = await onFindCatalogLocation(parsedGeonameId);
      if (existingEntry) {
        setCatalogEntry(existingEntry);
        return;
      }
      if (!canVerify) {
        setCatalogMiss(true);
        return;
      }
      const saved = await onVerify({
        ...location,
        geonameId: parsedGeonameId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        evidenceUrl: evidenceUrl.trim(),
        note: note.trim(),
      });
      if (saved) setOpen(false);
    } catch {
      // The dashboard owns the visible request error. Keep this panel and all
      // entered evidence open so the administrator can correct or retry it.
    } finally {
      setChecking(false);
    }
  }

  async function confirmCatalogEntry() {
    if (!catalogEntry) return;
    setChecking(true);
    const saved = await onVerify(canonicalLocationFromCatalogEntry(catalogEntry, evidenceUrl, note));
    setChecking(false);
    if (saved) {
      setCatalogEntry(null);
      setOpen(false);
    }
  }

  return (
    <div className="border-b border-[var(--line)] py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{school.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <MapPinOff size={12} aria-hidden="true" />
            {school.city || "No legacy city supplied"} · {locationStatus.replace("_", " ")}
          </p>
        </div>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          aria-expanded={open}
          aria-controls={`school-location-panel-${school.id}`}
          disabled={busy}
          onClick={() => {
            setCatalogEntry(null);
            setOpen((current) => !current);
          }}
        >
          {open ? "Close review" : "Verify location"}
        </Button>
      </div>

      {open && (
        <div id={`school-location-panel-${school.id}`} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
          {school.location_public_note && <p className="mb-3 rounded-lg bg-[var(--amber-soft)] p-3 text-xs leading-5 text-[var(--ink-muted)]">{school.location_public_note}</p>}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
            <p className="max-w-xl text-[10px] leading-5 text-[var(--ink-faint)]">
              Find the city-level place in GeoNames. The numeric ID appears in its page URL; copy that record&apos;s latitude and longitude. GeoNames identifies the place but does not count as the independent school evidence below.
            </p>
            <a href={geonamesSearchUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[var(--accent)]">
              Search GeoNames <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
          <SchoolLocationFields
            value={location}
            onChange={(nextLocation) => {
              setCatalogEntry(null);
              setLocation(nextLocation);
            }}
            idPrefix={`school-location-${school.id}`}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-[11px] font-bold">GeoNames ID <span className="font-normal text-[var(--ink-faint)]">(URL number)</span><input required inputMode="numeric" value={geonameId} onChange={(event) => { setCatalogEntry(null); setCatalogMiss(false); setGeonameId(event.target.value); }} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
            <label className="text-[11px] font-bold">City-centre latitude<input required inputMode="decimal" value={latitude} onChange={(event) => { setCatalogEntry(null); setLatitude(event.target.value); }} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
            <label className="text-[11px] font-bold">City-centre longitude<input required inputMode="decimal" value={longitude} onChange={(event) => { setCatalogEntry(null); setLongitude(event.target.value); }} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
          </div>
          <label className="mt-3 block text-[11px] font-bold">Independent evidence URL <span className="font-normal text-[var(--ink-faint)]">(school or institutional source, not GeoNames)</span><input required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://official-school-or-registry.example/…" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
          <label className="mt-3 block text-[11px] font-bold">Internal review note <span className="font-normal text-[var(--ink-faint)]">(optional)</span><textarea maxLength={2000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs" /></label>
          {catalogMiss && (
            <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 text-[10px] leading-5 text-[var(--ink-muted)]">
              This ID is not in the verified directory yet. Complete the country or area, city-centre coordinates and independent evidence, then confirm it as a new canonical place.
            </p>
          )}
          {catalogEntry ? (
            <ExistingLocationMatch entry={catalogEntry} busy={busy || checking} canUse={isValidIndependentLocationEvidenceUrl(evidenceUrl)} onUse={() => void confirmCatalogEntry()} onEdit={() => setCatalogEntry(null)} />
          ) : (
            <Button className="mt-3" size="sm" type="button" disabled={busy || checking || !isValidGeonameId(geonameId)} onClick={() => void verify()}>
              {checking && <LoaderCircle className="animate-spin" size={13} aria-hidden="true" />}
              {canVerify ? "Check and confirm location" : "Check GeoNames ID"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function VerifiedSchoolLocationControl({
  school,
  busy,
  onRequestCorrection,
}: {
  school: School;
  busy: boolean;
  onRequestCorrection: (note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const panelId = `withdraw-school-location-${school.id}`;

  async function requestCorrection() {
    if (note.trim().length < 2) return;
    const saved = await onRequestCorrection(note.trim());
    if (saved) {
      setNote("");
      setOpen(false);
    }
  }

  return (
    <div className="border-b border-[var(--line)] py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{school.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <MapPinCheck size={12} aria-hidden="true" />
            {school.city ?? "Verified city"} · {school.location_key}
          </p>
        </div>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          disabled={busy}
          onClick={() => setOpen((current) => !current)}
        >
          Withdraw from map
        </Button>
      </div>
      {open && (
        <div id={panelId} className="mt-3 rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-4">
          <label htmlFor={`${panelId}-note`} className="flex items-center gap-2 text-xs font-bold">
            <TriangleAlert size={14} aria-hidden="true" /> Why can this location no longer be trusted?
          </label>
          <textarea
            id={`${panelId}-note`}
            autoFocus
            required
            minLength={2}
            maxLength={500}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-3 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-3 text-xs"
          />
          <Button className="mt-3" size="sm" type="button" variant="secondary" disabled={busy || note.trim().length < 2} onClick={() => void requestCorrection()}>
            Mark location for correction
          </Button>
        </div>
      )}
    </div>
  );
}
