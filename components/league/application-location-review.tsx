"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MapPinCheck, ShieldQuestion, TriangleAlert } from "lucide-react";
import { SchoolLocationFields } from "@/components/league/school-location-fields";
import { Button } from "@/components/ui/button";
import {
  isCompleteSchoolLocation,
  isValidCoordinate,
  isValidGeonameId,
  isValidIndependentLocationEvidenceUrl,
  type CanonicalSchoolLocationInput,
  type SchoolLocationSubmission,
} from "@/lib/league/geographic-areas";
import type { LeagueApplication } from "@/lib/league/types";

const statusLabel: Record<LeagueApplication["location_status"], string> = {
  missing: "Legacy location missing",
  pending_review: "Pending location review",
  verified: "Verified city location",
  needs_correction: "Applicant correction required",
};

type ReviewMode = "match" | "verify" | "correction" | null;

export function ApplicationLocationReview({
  application,
  busy,
  onMatch,
  onVerify,
  onRequestCorrection,
}: {
  application: LeagueApplication;
  busy: boolean;
  onMatch: (evidenceUrl: string, note: string) => Promise<void>;
  onVerify: (location: CanonicalSchoolLocationInput) => Promise<void>;
  onRequestCorrection: (note: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<ReviewMode>(null);
  const [canonicalLocation, setCanonicalLocation] = useState<SchoolLocationSubmission>({
    areaKey: application.submitted_area_key ?? "",
    areaLabel: application.submitted_area_label ?? "",
    administrativeArea: application.submitted_administrative_area ?? "",
    city: application.submitted_city ?? "",
  });
  const [geonameId, setGeonameId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const activeApplication = application.status === "submitted" || application.status === "under_review";

  const geonamesSearchUrl = useMemo(() => {
    const query = [application.submitted_city, application.submitted_administrative_area, application.submitted_area_label]
      .filter(Boolean)
      .join(" ");
    return `https://www.geonames.org/search.html?q=${encodeURIComponent(query)}`;
  }, [application]);

  const canVerify = Boolean(
    isCompleteSchoolLocation(canonicalLocation)
      && isValidGeonameId(geonameId)
      && isValidCoordinate(latitude, -90, 90)
      && isValidCoordinate(longitude, -180, 180)
      && isValidIndependentLocationEvidenceUrl(evidenceUrl),
  );

  async function verify() {
    if (!canVerify) return;
    await onVerify({
      ...canonicalLocation,
      geonameId: Number(geonameId),
      latitude: Number(latitude),
      longitude: Number(longitude),
      evidenceUrl: evidenceUrl.trim(),
      note: reviewNote.trim(),
    });
    setMode(null);
  }

  async function match() {
    if (!isValidIndependentLocationEvidenceUrl(evidenceUrl)) return;
    await onMatch(evidenceUrl.trim(), reviewNote.trim());
    setMode(null);
  }

  async function requestCorrection() {
    if (correctionNote.trim().length < 2) return;
    await onRequestCorrection(correctionNote.trim());
    setMode(null);
  }

  return (
    <div className="mt-3 border-l-2 border-[var(--line-strong)] pl-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--ink-faint)]">{statusLabel[application.location_status]}</p>
        {application.location_key && <code className="text-[9px] text-[var(--ink-faint)]">{application.location_key}</code>}
      </div>

      <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
        {[application.submitted_city, application.submitted_administrative_area, application.submitted_area_label]
          .filter(Boolean)
          .join(" · ") || "No structured location was collected for this legacy application."}
      </p>

      {activeApplication && application.location_status !== "verified" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            type="button"
            aria-expanded={mode === "match"}
            aria-controls={`match-location-${application.id}`}
            disabled={busy || !application.submitted_city}
            onClick={() => setMode(mode === "match" ? null : "match")}
          >
            <MapPinCheck size={13} /> Match verified city
          </Button>
          <Button size="sm" type="button" variant="secondary" aria-expanded={mode === "verify"} aria-controls={`verify-location-${application.id}`} disabled={busy} onClick={() => setMode(mode === "verify" ? null : "verify")}>
            Verify new place
          </Button>
          <Button size="sm" type="button" variant="secondary" aria-expanded={mode === "correction"} aria-controls={`correct-location-${application.id}`} disabled={busy} onClick={() => setMode(mode === "correction" ? null : "correction")}>
            <ShieldQuestion size={13} /> Request correction
          </Button>
        </div>
      )}

      {activeApplication && mode === "match" && (
        <div id={`match-location-${application.id}`} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
          <p className="text-xs font-bold">Confirm this school uses the submitted city</p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--ink-faint)]">
            Exact catalog matching only resolves the city record. An independent school or institutional source is still required.
          </p>
          <label htmlFor={`match-evidence-${application.id}`} className="mt-3 block text-[11px] font-bold">
            Independent evidence URL
            <input id={`match-evidence-${application.id}`} required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" />
          </label>
          <label htmlFor={`match-note-${application.id}`} className="mt-3 block text-[11px] font-bold">
            Internal review note <span className="font-normal text-[var(--ink-faint)]">(optional, never public)</span>
            <textarea id={`match-note-${application.id}`} maxLength={2000} rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs" />
          </label>
          <Button className="mt-3" size="sm" type="button" disabled={busy || !isValidIndependentLocationEvidenceUrl(evidenceUrl)} onClick={() => void match()}>Confirm exact catalog match</Button>
        </div>
      )}

      {activeApplication && mode === "verify" && (
        <div id={`verify-location-${application.id}`} className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold">Bind a canonical city</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--ink-faint)]">Check GeoNames and an independent school or institutional source. Coordinates must be the city centre, never a campus address.</p>
            </div>
            <a href={geonamesSearchUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[var(--accent)]">GeoNames <ExternalLink size={11} /></a>
          </div>
          <div className="mt-4">
            <SchoolLocationFields value={canonicalLocation} onChange={setCanonicalLocation} idPrefix={`verify-${application.id}`} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-[11px] font-bold">GeoNames ID<input required inputMode="numeric" value={geonameId} onChange={(event) => setGeonameId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
            <label className="text-[11px] font-bold">City-centre latitude<input required inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
            <label className="text-[11px] font-bold">City-centre longitude<input required inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
          </div>
          <label className="mt-3 block text-[11px] font-bold">Independent evidence URL<input required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://official-school-or-registry.example/…" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs" /></label>
          <label className="mt-3 block text-[11px] font-bold">Internal review note <span className="font-normal text-[var(--ink-faint)]">(optional, never public)</span><textarea maxLength={2000} rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs" /></label>
          <Button className="mt-3" size="sm" type="button" disabled={busy || !canVerify} onClick={() => void verify()}>Confirm canonical location</Button>
        </div>
      )}

      {activeApplication && mode === "correction" && (
        <div id={`correct-location-${application.id}`} className="mt-4 rounded-xl border border-[var(--amber)] bg-[var(--amber-soft)] p-4">
          <p className="flex items-center gap-2 text-xs font-bold"><TriangleAlert size={14} /> Tell the applicant what cannot be confirmed</p>
          <label htmlFor={`correction-note-${application.id}`} className="sr-only">Location correction instructions</label>
          <textarea id={`correction-note-${application.id}`} autoFocus maxLength={500} rows={3} value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} className="mt-3 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-3 text-xs" placeholder="For example: choose the province as well as the city because this city name is ambiguous." />
          <Button className="mt-3" size="sm" type="button" variant="secondary" disabled={busy || correctionNote.trim().length < 2} onClick={() => void requestCorrection()}>Return for correction</Button>
        </div>
      )}
    </div>
  );
}
