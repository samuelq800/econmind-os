"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Check,
  Crown,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRoomRefresh } from "@/lib/live-room/use-room-refresh";
import {
  getSeason1AdminOverview,
  subscribeToSeason1AdminOverview,
  unsubscribeSeason1AdminOverview,
  type Season1AdminOverview,
  type Season1AdminTeam,
} from "@/lib/supabase/season1-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function Season1AdminOverviewPanel({
  seasonId,
  userId,
}: {
  seasonId: string;
  userId: string;
}) {
  const [view, setView] = useState<Season1AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const refresh = useRoomRefresh(`${seasonId}:${userId}`, {
    fetch: getSeason1AdminOverview,
    onView: (next) => {
      if (next.seasonId !== seasonId) {
        setError("Season identity changed. Please reload the lobby.");
        return;
      }
      setView(next);
      setError("");
    },
    onError: () =>
      setError(
        "Live totals could not update. Displayed data may be out of date. Please retry.",
      ),
    terminal: () => false,
    subscribe: (_identity, change, status, disposed) =>
      subscribeToSeason1AdminOverview(seasonId, change, status, disposed),
    unsubscribe: unsubscribeSeason1AdminOverview,
  });
  const normalized = query.trim().toLowerCase();
  const teams = (view?.teams ?? []).filter((team) =>
    `${team.name} ${team.code} ${team.schoolName ?? ""} ${team.members.map((m) => `${m.displayName} ${m.schoolName ?? ""}`).join(" ")}`
      .toLowerCase()
      .includes(normalized),
  );
  const selected = view?.teams.find((team) => team.id === selectedId);
  return (
    <section
      id="admin-overview"
      aria-labelledby="admin-overview-title"
      className="season1-chapter border-b border-[var(--line)] py-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="season1-chapter-label flex items-center gap-2">
            <ShieldCheck size={16} /> ADMIN / LIVE OVERVIEW
          </p>
          <h2 id="admin-overview-title" className="mt-3 text-3xl font-bold">
            Season 1 at a glance.
          </h2>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Administrator-only totals and team rosters. Team changes update
            live, with a 15-second fallback while connected.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          <RefreshCw size={15} /> Refresh overview
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}
      {!view ? (
        <p role="status" className="mt-6 text-sm text-[var(--ink-muted)]">
          {error
            ? "No verified totals are available."
            : "Loading live totals and team rosters…"}
        </p>
      ) : (
        <>
          <dl className="mt-7 grid grid-cols-2 gap-4 xl:grid-cols-6">
            {(
              [
                ["Season 1 participants", view.stats.participants],
                ["Teams", view.stats.teams],
                ["In teams", view.stats.teamMembers],
                ["Free agents", view.stats.freeAgents],
                ["Ready members", view.stats.readyMembers],
                ["Platform accounts", view.stats.registeredPlayers],
              ] as const
            ).map(([label, count]) => (
              <Card key={label} className="p-5">
                <dt className="text-xs font-bold text-[var(--ink-muted)]">
                  {label}
                </dt>
                <dd className="mt-3 text-3xl font-bold tabular-nums text-[var(--accent)]">
                  {count.toLocaleString()}
                </dd>
              </Card>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
            Participants = members of current teams + available free agents,
            counted once. Platform accounts = all active registered accounts,
            not concurrent visitors. Dissolved teams are excluded. Last updated:{" "}
            <time dateTime={view.snapshotAt}>
              {new Date(view.snapshotAt).toLocaleTimeString()}
            </time>
            .
          </p>
          <label className="mt-7 flex max-w-xl items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <Search size={17} className="shrink-0 text-[var(--ink-muted)]" />
            <span className="sr-only">Search administrator team rosters</span>
            <input
              className="w-full min-w-0 bg-transparent text-sm outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team, code, member or school"
            />
          </label>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <Card key={team.id} className="flex min-w-0 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="break-words text-lg font-bold">{team.name}</h3>
                  <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">
                    {team.status}
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-[var(--ink-muted)]">
                  {team.code}
                </p>
                <p className="mt-3 text-sm text-[var(--ink-muted)]">
                  Captain:{" "}
                  {team.members.find(
                    (member) => member.memberRole === "captain",
                  )?.displayName ?? "Not assigned"}
                </p>
                <p className="mt-2 text-sm">
                  {team.memberCount} / {team.capacity} members ·{" "}
                  {team.readyCount} ready
                </p>
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  {team.recruitmentLocked
                    ? "Recruitment locked"
                    : team.recruiting
                      ? "Recruiting"
                      : "Not recruiting"}{" "}
                  · {team.applicationCount} pending applications
                </p>
                <Button
                  className="mt-5 w-full"
                  variant="secondary"
                  onClick={() => setSelectedId(team.id)}
                >
                  View team details <ArrowUpRight size={16} />
                </Button>
              </Card>
            ))}
          </div>
          {!teams.length && (
            <p className="mt-5 text-sm text-[var(--ink-muted)]">
              {query ? "No teams match your search." : "No current teams yet."}
            </p>
          )}
        </>
      )}
      {selected && (
        <TeamDetails team={selected} close={() => setSelectedId(null)} />
      )}
    </section>
  );
}

function TeamDetails({
  team,
  close,
}: {
  team: Season1AdminTeam;
  close: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const latestClose = useRef(close);
  useEffect(() => {
    latestClose.current = close;
  });
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        latestClose.current();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const controls = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'button, a[href], input, [tabindex="0"]',
        ),
      );
      const first = controls[0],
        last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className="season1-admin-modal fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-7"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-team-title"
        className="max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-[var(--accent)]">
              ADMIN / TEAM DETAILS
            </p>
            <h2
              id="admin-team-title"
              className="mt-3 break-words text-3xl font-bold"
            >
              {team.name}
            </h2>
            <p className="mt-3 break-all font-mono text-sm">{team.code}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-10 w-10 shrink-0 p-0"
            aria-label="Close team details"
            onClick={close}
          >
            <X size={20} />
          </Button>
        </div>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ink-muted)]">
          {team.description || team.focus || "No description provided."}
        </p>
        <dl className="my-6 grid grid-cols-2 gap-4 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-3">
          {[
            ["Members", `${team.memberCount} / ${team.capacity}`],
            ["Ready", String(team.readyCount)],
            ["Status", team.status],
            [
              "Recruitment",
              team.recruitmentLocked
                ? "Locked"
                : team.recruitmentMode.replaceAll("_", " "),
            ],
            ["Language", team.preferredLanguage],
            ["Home school", team.schoolName ?? "Not specified"],
            ["Team style", team.teamStyle],
            ["Pending applications", String(team.applicationCount)],
            ["Created", new Date(team.createdAt).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-[var(--ink-muted)]">{label}</dt>
              <dd className="mt-1 break-words text-sm font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <h3 className="text-xl font-bold">Team members</h3>
        <ul className="mt-4 space-y-3">
          {team.members.map((member) => (
            <li
              key={member.userId}
              className="rounded-xl border border-[var(--line)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="flex min-w-0 items-center gap-2 break-words">
                  {member.memberRole === "captain" && (
                    <Crown
                      size={16}
                      className="shrink-0 text-[var(--accent)]"
                    />
                  )}
                  {member.displayName}
                </strong>
                <span className="flex items-center gap-2 text-xs">
                  {member.isReady && <Check size={14} />}
                  {member.memberRole === "captain"
                    ? "Captain"
                    : "Member"} · {member.isReady ? "Ready" : "Not ready"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                {member.schoolName ?? "No school linked"}
              </p>
              <p className="mt-2 text-xs leading-5">
                Role preferences:{" "}
                {member.rolePreferences.length
                  ? member.rolePreferences.join(" · ")
                  : "Not selected"}
              </p>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                Joined {new Date(member.joinedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
        {!team.members.length && (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            No members currently in this team.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
