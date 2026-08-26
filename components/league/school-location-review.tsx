"use client";

import { useState } from "react";
import { MapPinCheck, MapPinOff, TriangleAlert } from "lucide-react";
import { EMPTY_SCHOOL_LOCATION, SchoolLocationFields } from "@/components/league/school-location-fields";
import { Button } from "@/components/ui/button";
import {
  isCompleteSchoolLocation,
  isValidCoordinate,
  isValidGeonameId,
  isValidIndependentLocationEvidenceUrl,
  type CanonicalSchoolLocationInput,
} from "@/lib/league/geographic-areas";
import type { School } from "@/lib/league/types";

export function SchoolLocationReview({
  school,
  busy,
  onVerify,
}: {
  school: School;
  busy: boolean;
  onVerify: (location: CanonicalSchoolLocationInput) => Promise<void>;
}) {
  const locationStatus = school.location_status ?? "missing";
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState({ ...EMPTY_SCHOOL_LOCATION, city: school.city ?? "" });
  const [geonameId, setGeonameId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");

  const canVerify = isCompleteSchoolLocation(location)
    && isValidGeonameId(geonameId)
    && isValidCoordinate(latitude, -90, 90)
    && isValidCoordinate(longitude, -180, 180)
    && isValidIndependentLocationEvidenceUrl(evidenceUrl);

  async function verify() {
    if (!canVerify) return;
    await onVerify({
      ...location,
      geonameId: Number(geonameId),
      latitude: Number(latitude),
      longitude: Number(longitude),
      evidenceUrl: evidenceUrl.trim(),
      note: note.trim(),
    });
    setOpen(false);
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
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Close review" : "Verify location"}
        </Button>
      </div>

      {open && (
        <div id={`school-location-panel-${school.id}`} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
          {school.location_public_note && <p className="mb-3 rounded-lg bg-[var(--amber-soft)] p-3 text-xs leading-5 text-[var(--ink-muted)]">{school.location_public_note}</p>}
          <SchoolLocationFields value={location} onChange={setLocation} idPrefix={`school-location-${school.id}`} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-[11px] font-bold">GeoNames ID<input required inputMode="numeric" value={geonameId} onChange={(event) => setGeonameId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
            <label className="text-[11px] font-bold">City-centre latitude<input required inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
            <label className="text-[11px] font-bold">City-centre longitude<input required inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
          </div>
          <label className="mt-3 block text-[11px] font-bold">Independent evidence URL<input required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
          <label className="mt-3 block text-[11px] font-bold">Internal review note <span className="font-normal text-[var(--ink-faint)]">(optional)</span><textarea maxLength={2000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs" /></label>
          <Button className="mt-3" size="sm" type="button" disabled={busy || !canVerify} onClick={() => void verify()}>Confirm city-level location</Button>
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
  onRequestCorrection: (note: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const panelId = `withdraw-school-location-${school.id}`;

  async function requestCorrection() {
    if (note.trim().length < 2) return;
    await onRequestCorrection(note.trim());
    setNote("");
    setOpen(false);
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
