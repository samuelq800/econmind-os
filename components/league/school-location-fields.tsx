"use client";

import { MapPinned } from "lucide-react";
import {
  COUNTRY_OR_AREA_OPTIONS,
  GEOGRAPHIC_LABEL_DISCLAIMER,
  getCountryOrArea,
  type SchoolLocationSubmission,
} from "@/lib/league/geographic-areas";
import { SCHOOL_CITY_LOCATIONS } from "@/lib/league/school-locations";

export const EMPTY_SCHOOL_LOCATION: SchoolLocationSubmission = {
  areaKey: "",
  areaLabel: "",
  administrativeArea: "",
  city: "",
};

export function SchoolLocationFields({
  value,
  onChange,
  idPrefix,
}: {
  value: SchoolLocationSubmission;
  onChange: (next: SchoolLocationSubmission) => void;
  idPrefix: string;
}) {
  const selectedArea = getCountryOrArea(value.areaKey);
  const hasAdministrativeAreas = Boolean(selectedArea?.administrativeAreas.length);
  const catalogCities = SCHOOL_CITY_LOCATIONS
    .filter((location) => `geoarea:${location.countryCode}` === value.areaKey)
    .sort((left, right) => left.city.localeCompare(right.city));
  const cityListId = `${idPrefix}-catalog-cities`;

  return (
    <fieldset className="border-l-2 border-[var(--accent)] bg-[var(--surface-subtle)] px-4 py-4">
      <legend className="sr-only">Approximate school location</legend>
      <div className="flex items-start gap-3">
        <MapPinned className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} aria-hidden="true" />
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.11em]">Approximate location</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">
            Choose the city your school uses publicly. Do not enter a street or campus address.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${idPrefix}-area`} className="text-xs font-bold">
          Country or area
          <select
            id={`${idPrefix}-area`}
            required
            value={value.areaKey}
            onChange={(event) => {
              const area = getCountryOrArea(event.target.value);
              onChange({
                ...value,
                areaKey: area?.key ?? "",
                areaLabel: area?.label ?? "",
                administrativeArea: "",
              });
            }}
            className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">Select country or area</option>
            {COUNTRY_OR_AREA_OPTIONS.map((area) => (
              <option key={area.key} value={area.key}>{area.label}</option>
            ))}
          </select>
        </label>

        {hasAdministrativeAreas ? (
          <label htmlFor={`${idPrefix}-administrative-area`} className="text-xs font-bold">
            State, province or region
            <select
              id={`${idPrefix}-administrative-area`}
              required
              value={value.administrativeArea}
              onChange={(event) => onChange({ ...value, administrativeArea: event.target.value })}
              className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="">Select administrative area</option>
              {selectedArea?.administrativeAreas.map((administrativeArea) => (
                <option key={administrativeArea} value={administrativeArea}>{administrativeArea}</option>
              ))}
            </select>
          </label>
        ) : (
          <label htmlFor={`${idPrefix}-administrative-area`} className="text-xs font-bold">
            State, province or region <span className="font-normal text-[var(--ink-faint)]">(if applicable)</span>
            <input
              id={`${idPrefix}-administrative-area`}
              maxLength={100}
              value={value.administrativeArea}
              onChange={(event) => onChange({ ...value, administrativeArea: event.target.value })}
              className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
        )}
      </div>

      <label htmlFor={`${idPrefix}-city`} className="mt-4 block text-xs font-bold">
        City or locality
        <input
          id={`${idPrefix}-city`}
          required
          minLength={2}
          maxLength={100}
          value={value.city}
          list={catalogCities.length > 0 ? cityListId : undefined}
          onChange={(event) => {
            const city = event.target.value;
            const catalogCity = catalogCities.find(
              (location) => location.city.localeCompare(city, undefined, { sensitivity: "accent" }) === 0,
            );
            onChange({
              ...value,
              city,
              administrativeArea: catalogCity?.administrativeArea ?? value.administrativeArea,
            });
          }}
          className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          placeholder="City-level location only"
        />
        {catalogCities.length > 0 ? (
          <datalist id={cityListId}>
            {catalogCities.map((location) => <option key={location.locationKey} value={location.city} />)}
          </datalist>
        ) : null}
      </label>

      <p className="mt-2 text-[10px] leading-4 text-[var(--ink-muted)]">
        Select a listed city to verify its map marker automatically. New cities remain available and will be reviewed.
      </p>

      <p className="mt-3 text-[10px] leading-4 text-[var(--ink-faint)]">{GEOGRAPHIC_LABEL_DISCLAIMER}</p>
    </fieldset>
  );
}
