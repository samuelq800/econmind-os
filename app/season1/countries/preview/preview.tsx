"use client";
import { useState } from "react";
import { CountryPreferencePanel } from "@/components/season1/season1-country-preferences";
import { Season1WorldMap } from "@/components/season1/season1-world-map";
import { Season1WorkspaceNav } from "@/components/season1/season1-workspace-nav";
import { Season1CountryHero } from "@/components/season1/season1-country-hero";
import {
  season1Countries,
  type CountryPreferenceView,
} from "@/lib/season1/countries";

const initial: CountryPreferenceView = {
  seasonId: "local-preview",
  serverNow: "2026-10-18T08:00:00Z",
  myTeam: {
    id: "demo-team",
    name: "EconMind · Horizon",
    memberCount: 4,
    recruitmentLocked: true,
    isCaptain: true,
    eligible: true,
    preference: null,
  },
  countries: season1Countries.map((country) => ({
    code: country.code,
    reserved: false,
    selectedByMyTeam: false,
  })),
};

export function CountryPreferencePreview() {
  const [view, setView] = useState(initial);
  const [failConflict, setFailConflict] = useState(false);
  const changeTeam = (
    patch: Partial<NonNullable<CountryPreferenceView["myTeam"]>>,
  ) =>
    setView((previous) => {
      const team = { ...previous.myTeam!, ...patch };
      if (!team.recruitmentLocked || team.memberCount < 3)
        team.preference = null;
      team.eligible =
        team.isCaptain && team.recruitmentLocked && team.memberCount >= 3;
      return {
        ...previous,
        myTeam: team,
        countries: previous.countries.map((country) => ({
          ...country,
          reserved: country.selectedByMyTeam
            ? team.preference?.code === country.code
            : country.reserved,
          selectedByMyTeam: team.preference?.code === country.code,
        })),
      };
    });
  return (
    <main
      className="season1-lobby"
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top right,#143f4c,#04121e 70%)",
        color: "#d8e9eb",
        padding: "clamp(16px,4vw,64px)",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "auto" }}>
        <Season1WorkspaceNav active="countries" preview />
        <p style={{ color: "#e3c58d", fontSize: 12, letterSpacing: 2 }}>
          LOCAL DEMO / NO PRODUCTION WRITES
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "#adc5cc" }}>
          Shared production UI with simulated team state. Nothing is saved to
          production. All 70 country scenes come from the pinned World
          repository.
        </p>
        <div
          aria-label="Local demo controls"
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            padding: "20px 0",
            fontSize: 13,
          }}
        >
          <label>
            Members{" "}
            <select
              aria-label="Demo member count"
              style={{ background: "#15343e", padding: 8 }}
              value={view.myTeam!.memberCount}
              onChange={(e) =>
                changeTeam({ memberCount: Number(e.target.value) })
              }
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={view.myTeam!.recruitmentLocked}
              onChange={(e) =>
                changeTeam({ recruitmentLocked: e.target.checked })
              }
            />{" "}
            Recruitment locked
          </label>
          <label>
            <input
              type="checkbox"
              checked={view.myTeam!.isCaptain}
              onChange={(e) => changeTeam({ isCaptain: e.target.checked })}
            />{" "}
            Captain view
          </label>
          <label>
            <input
              type="checkbox"
              checked={failConflict}
              onChange={(e) => setFailConflict(e.target.checked)}
            />{" "}
            Simulate competing selection
          </label>
        </div>
        <Season1CountryHero />
        <Season1WorldMap />
        <CountryPreferencePanel
          view={view}
          save={async (teamId, code, expected) => {
            if (!view.myTeam?.eligible || teamId !== view.myTeam.id)
              throw new Error(
                "Only a captain of a locked team with at least 3 members can submit.",
              );
            if ((view.myTeam.preference?.code ?? null) !== expected)
              throw new Error(
                "Your team selection changed. Refresh and try again.",
              );
            if (failConflict) {
              setView((v) => ({
                ...v,
                countries: v.countries.map((c) =>
                  c.code === code
                    ? { ...c, reserved: true, selectedByMyTeam: false }
                    : c,
                ),
              }));
              setFailConflict(false);
              throw new Error(
                "This country has already been selected by another team. Choose another country.",
              );
            }
            if (
              view.countries.some(
                (c) => c.code === code && c.reserved && !c.selectedByMyTeam,
              )
            )
              throw new Error("This country is reserved.");
            setView((v) => ({
              ...v,
              myTeam: {
                ...v.myTeam!,
                preference: { code, selectedAt: new Date().toISOString() },
              },
              countries: v.countries.map((c) => ({
                ...c,
                reserved:
                  c.code === code || (!c.selectedByMyTeam && c.reserved),
                selectedByMyTeam: c.code === code,
              })),
            }));
          }}
        />
        <p style={{ color: "#7d9da6", fontSize: 12 }}>
          Preview controls demonstrate automatic release, captain-only
          submission and stale availability. The real database is verified
          separately using a disposable PostgreSQL fixture.
        </p>
      </div>
    </main>
  );
}
