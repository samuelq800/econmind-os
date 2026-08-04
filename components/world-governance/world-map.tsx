"use client";

import Link from "next/link";
import { MapPinned, Network, Route, ShieldAlert } from "lucide-react";
import { WORLD_COUNTRIES } from "@/lib/world-governance/config";
import { createCountry } from "@/lib/world-governance/simulation";

type MapMode = "political" | "trade" | "risk" | "resources";

const modeCopy: Record<MapMode, string> = {
  political: "Country status and office access",
  trade: "Fictional strategic trade connections",
  risk: "Teaching index of current stability exposure",
  resources: "Synthetic resource and infrastructure locations",
};

const stateColor = {
  normal: "var(--accent)",
  vulnerable: "#e8a22b",
  protest: "#e68a36",
  government_crisis: "#ef6a67",
  institutional_collapse: "#9a6b9d",
  empty_state: "#737a76",
  recovery: "#5d9bf2",
};

export function WorldMap({
  selectedCountryId,
  mode = "political",
  onModeChange,
  compact = false,
}: {
  selectedCountryId?: string;
  mode?: MapMode;
  onModeChange?: (mode: MapMode) => void;
  compact?: boolean;
}) {
  const positions = new Map(
    WORLD_COUNTRIES.map((country) => [
      country.id,
      { x: 8 + country.centroid.x * 8.6, y: 90 - country.centroid.y * 8.1 },
    ]),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface)_94%,#133264),color-mix(in_srgb,var(--surface)_90%,#0b665d))] shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-[var(--accent)]">
            <MapPinned size={17} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">
              Interconnected World Economy
            </h2>
            <p className="text-[11px] text-white/65">{modeCopy[mode]}</p>
          </div>
        </div>
        {onModeChange ? (
          <div
            className="flex rounded-lg bg-black/15 p-1"
            aria-label="World map layer"
          >
            {(Object.keys(modeCopy) as MapMode[]).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => onModeChange(item)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold capitalize transition ${mode === item ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div
        className={`relative ${compact ? "h-[310px]" : "h-[460px]"} overflow-hidden`}
      >
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:48px_48px]" />
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="world-route" x1="0" x2="1">
              <stop stopColor="#62d0b0" stopOpacity=".12" />
              <stop offset=".5" stopColor="#f6d365" stopOpacity=".78" />
              <stop offset="1" stopColor="#62d0b0" stopOpacity=".12" />
            </linearGradient>
          </defs>
          {WORLD_COUNTRIES.flatMap((country) =>
            country.neighbors
              .filter((neighbor) => country.id < neighbor)
              .map((neighbor) => {
                const start = positions.get(country.id);
                const end = positions.get(neighbor);
                return start && end ? (
                  <line
                    key={`${country.id}-${neighbor}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="url(#world-route)"
                    strokeWidth=".45"
                    strokeDasharray={mode === "risk" ? "1 1" : undefined}
                  />
                ) : null;
              }),
          )}
          <path
            d="M7 72 C24 58, 27 79, 44 66 S69 74, 92 39"
            fill="none"
            stroke="rgba(255,255,255,.12)"
            strokeWidth="1.1"
          />
          <path
            d="M6 20 C24 36, 39 20, 56 38 S81 29, 98 18"
            fill="none"
            stroke="rgba(255,255,255,.1)"
            strokeWidth=".7"
          />
        </svg>
        {WORLD_COUNTRIES.map((country) => {
          const position = positions.get(country.id)!;
          const state = createCountry(country.id);
          const active = country.id === selectedCountryId;
          return (
            <Link
              key={country.id}
              href={`/league/world/country/${country.id}`}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2.5 py-2 text-left transition hover:-translate-y-[55%] hover:border-white/60 hover:bg-white/15 ${active ? "border-white bg-white/20 shadow-[0_0_0_4px_rgba(255,255,255,.12)]" : "border-white/20 bg-[#0a1724]/65"}`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold text-white">
                <i
                  className="size-2 rounded-full"
                  style={{ backgroundColor: stateColor[state.condition] }}
                />
                {country.name}
              </span>
              {!compact ? (
                <span className="mt-1 block whitespace-nowrap text-[9px] font-medium uppercase tracking-[.12em] text-white/55">
                  {country.regions[0]}
                </span>
              ) : null}
            </Link>
          );
        })}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-white/10 bg-[#06121d]/70 px-2.5 py-2 text-[10px] text-white/65 backdrop-blur">
          {mode === "trade" ? (
            <Route size={13} />
          ) : mode === "risk" ? (
            <ShieldAlert size={13} />
          ) : (
            <Network size={13} />
          )}
          Fictional geography · teaching simulation only
        </div>
      </div>
    </section>
  );
}
