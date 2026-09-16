"use client";

import {
  Check,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  acceptSeason1Application,
  applyToSeason1Team,
  createSeason1Team,
  getSeason1AdminLobby,
  postSeason1LobbyMessage,
  postSeason1TeamMessage,
  SEASON_1_ROLE_PREFERENCES,
  setSeason1Preferences,
  setSeason1Readiness,
  type Season1LobbyData,
  type Season1RolePreference,
} from "@/lib/supabase/season1";

function messageFor(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function Season1TeamLobby() {
  const {
    user,
    loading: authLoading,
    roleLoading,
    worldSupervisor,
  } = useAuth();
  const [lobby, setLobby] = useState<Season1LobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [focus, setFocus] = useState("");
  const [capacity, setCapacity] = useState(6);
  const [draft, setDraft] = useState("");
  const [teamDraft, setTeamDraft] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setLobby(await getSeason1AdminLobby());
    } catch (caught) {
      setError(messageFor(caught, "The Season 1 lobby could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || roleLoading) return;
    const timer = window.setTimeout(() => {
      if (worldSupervisor) void refresh();
      else setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, roleLoading, worldSupervisor]);

  const currentTeam = lobby?.currentMembership
    ? (lobby.teams.find(
        (team) => team.id === lobby.currentMembership?.teamId,
      ) ?? null)
    : null;
  const visibleTeams = useMemo(
    () =>
      (lobby?.teams ?? []).filter((team) =>
        `${team.name} ${team.focus}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [lobby?.teams, query],
  );

  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(messageFor(caught, "The Season 1 lobby could not be updated."));
    } finally {
      setBusy(false);
    }
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      await createSeason1Team({
        name: teamName.trim(),
        focus: focus.trim(),
        capacity,
        preferences: lobby?.currentMembership?.rolePreferences ?? [],
      });
      setCreateOpen(false);
      setTeamName("");
      setFocus("");
    });
  }

  async function sendLobbyMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    await mutate(async () => {
      await postSeason1LobbyMessage(content);
      setDraft("");
    });
  }

  async function sendTeamMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentTeam) return;
    const content = teamDraft.trim();
    if (!content) return;
    await mutate(async () => {
      await postSeason1TeamMessage(currentTeam.id, content);
      setTeamDraft("");
    });
  }

  async function togglePreference(role: Season1RolePreference) {
    const current = lobby?.currentMembership?.rolePreferences ?? [];
    const next = current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role];
    await mutate(() => setSeason1Preferences(next));
  }

  if (authLoading || roleLoading || loading)
    return (
      <StateCard
        title="Checking administrator access…"
        detail="Loading the real Season 1 lobby."
        loading
      />
    );
  if (!user || !worldSupervisor)
    return (
      <StateCard
        title="Platform administrator access required"
        detail="Season 1 currently opens only to Platform Admin accounts."
      />
    );
  if (!lobby)
    return (
      <StateCard
        title="Season 1 is unavailable"
        detail={error || "The Season 1 configuration could not be found."}
        retry={() => void refresh()}
      />
    );

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
      <section className="relative overflow-hidden rounded-2xl border border-[#255e50] bg-[radial-gradient(circle_at_80%_12%,#1a5c4a_0%,#102b24_42%,#0b1915_100%)] px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(190,244,218,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(190,244,218,.16)_1px,transparent_1px)] [background-size:52px_52px]"
        />
        <div className="relative grid gap-9 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.19em] text-[#9de8c8]">
              {lobby.season.displayName} · Platform administration
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold tracking-[-.075em] sm:text-6xl lg:text-7xl">
              Build the team before the world begins.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              This is the real, persistent Pre-Season layer. It creates teams,
              applications, role preferences, readiness, and chat messages only.
              The simulation remains structurally locked.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button disabled={busy} onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> Create team
              </Button>
              <a
                href="#discover"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/18"
              >
                Discover teams
              </a>
            </div>
          </div>
          <Card className="border-white/15 bg-[#0b211a]/75 p-5 text-white shadow-none backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9de8c8]">
              Season status
            </p>
            <dl className="mt-4 divide-y divide-white/13">
              <Status label="Team Lobby" value="Open now" green />
              <Status
                label="Registration"
                value={lobby.season.registrationOpen ? "Open" : "Coming soon"}
              />
              <Status
                label="Simulation"
                value={lobby.season.simulationLocked ? "Locked" : "Unavailable"}
                amber
              />
            </dl>
            <p className="mt-4 border-t border-white/13 pt-4 text-[11px] leading-5 text-white/55">
              Only Platform Admin accounts can enter this initial release. Table
              writes are restricted to server-side functions.
            </p>
          </Card>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}

      <section id="discover" className="border-b border-[var(--line)] py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
              Discover teams
            </p>
            <h2 className="mt-2 text-4xl font-bold tracking-[-.06em]">
              Real teams, no simulation state.
            </h2>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void refresh()}
          >
            {busy ? <LoaderCircle className="animate-spin" size={14} /> : null}{" "}
            Refresh
          </Button>
        </div>
        <label className="mt-7 flex max-w-md items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3">
          <Search size={15} className="text-[var(--ink-faint)]" />
          <span className="sr-only">Search teams</span>
          <input
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams or recruitment focus"
          />
        </label>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {visibleTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              busy={busy}
              applied={lobby.applicationTeamIds.includes(team.id)}
              hasTeam={Boolean(currentTeam)}
              onApply={() => void mutate(() => applyToSeason1Team(team.id))}
            />
          ))}
          {!visibleTeams.length && (
            <Card className="p-7 text-sm leading-6 text-[var(--ink-muted)]">
              No teams have been created yet. Create the first real Season 1
              team.
            </Card>
          )}
        </div>
      </section>

      <section className="grid gap-7 border-b border-[var(--line)] py-14 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            Role preferences
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-[-.06em]">
            Signal interest, not a permanent office.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
            Preferences are stored on your active team membership. They do not
            grant an office or create a country assignment.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {SEASON_1_ROLE_PREFERENCES.map((role) => (
              <button
                key={role}
                type="button"
                disabled={!currentTeam || busy}
                aria-pressed={lobby.currentMembership?.rolePreferences.includes(
                  role,
                )}
                onClick={() => void togglePreference(role)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-45 ${lobby.currentMembership?.rolePreferences.includes(role) ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
              >
                {role}
              </button>
            ))}
          </div>
          {!currentTeam && (
            <p className="mt-3 text-xs text-[var(--ink-faint)]">
              Join or create a team before setting preferences.
            </p>
          )}
        </div>
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
                Free Agents
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-.045em]">
                Available across affiliations.
              </h2>
            </div>
            <UsersRound className="text-[var(--accent)]" size={22} />
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Schools are visible as context only, never as a membership boundary.
          </p>
          <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {lobby.freeAgents.map((agent) => (
              <article className="flex gap-3 py-4" key={agent.userId}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--accent)]">
                  {agent.displayName[0]}
                </span>
                <div>
                  <h3 className="text-sm font-bold">{agent.displayName}</h3>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    {agent.schoolName ?? "Independent / no school affiliation"}
                  </p>
                </div>
              </article>
            ))}
            {!lobby.freeAgents.length && (
              <p className="py-5 text-sm text-[var(--ink-muted)]">
                No eligible free agents are currently available.
              </p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-7 border-b border-[var(--line)] py-14 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            My Team Room
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-.045em]">
            {currentTeam?.name ?? "Join a team to open Team Room."}
          </h2>
          {currentTeam ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                {currentTeam.focus ||
                  "This team has not written a recruitment focus yet."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
                <div>
                  <p className="text-sm font-bold">Team readiness</p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    {currentTeam.readyCount} / {currentTeam.memberCount} current
                    members are ready.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void mutate(() =>
                      setSeason1Readiness(!lobby.currentMembership!.isReady),
                    )
                  }
                >
                  {lobby.currentMembership?.isReady
                    ? "Mark not ready"
                    : "Mark ready"}
                </Button>
              </div>
              <Chat
                title="Team Chat"
                detail="Only active team members can post."
                messages={lobby.teamMessages}
                value={teamDraft}
                onChange={setTeamDraft}
                onSubmit={sendTeamMessage}
                disabled={busy}
              />
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-subtle)] p-5 text-sm leading-6 text-[var(--ink-muted)]">
              Create a team, or apply to a recruiting team. Acceptance adds the
              actual membership and unlocks Team Chat.
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
                Pending applications
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-.045em]">
                Admin review queue
              </h2>
            </div>
            <ShieldCheck className="text-[var(--accent)]" size={22} />
          </div>
          <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {lobby.pendingApplications.map((application) => (
              <article
                className="flex flex-wrap items-center justify-between gap-3 py-4"
                key={application.id}
              >
                <div>
                  <p className="text-sm font-bold">
                    {application.applicantName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Applied to {application.teamName}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void mutate(() => acceptSeason1Application(application.id))
                  }
                >
                  <Check size={14} /> Accept
                </Button>
              </article>
            ))}
            {!lobby.pendingApplications.length && (
              <p className="py-5 text-sm text-[var(--ink-muted)]">
                No applications await review.
              </p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-7 py-14 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
                World Lobby Chat
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-.045em]">
                Persistent pre-season conversation.
              </h2>
            </div>
            <MessageCircle className="text-[var(--accent)]" size={22} />
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Messages are stored outside the Simulation Event Ledger.
          </p>
          <Chat
            title="Lobby messages"
            detail="Platform Admins only in this release."
            messages={lobby.messages}
            value={draft}
            onChange={setDraft}
            onSubmit={sendLobbyMessage}
            disabled={busy}
          />
        </Card>
        <Card className="bg-[linear-gradient(145deg,color-mix(in_srgb,var(--surface)_90%,var(--accent-soft)),var(--surface))] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
            Guardrails
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-.045em]">
            Prepared, not simulated.
          </h2>
          <ul className="mt-6 grid gap-4">
            {[
              "The only stored records are pre-season teams, membership, preferences, readiness, applications, and chat.",
              "No team action writes a country, office, policy, economic state, or simulation event.",
              "Registration remains closed and simulation remains locked by the Season 1 record.",
              "Direct browser writes are revoked; all mutations are validated by database functions.",
            ].map((item) => (
              <li
                className="flex gap-3 border-t border-[var(--line)] pt-4 text-sm leading-6 text-[var(--ink-muted)]"
                key={item}
              >
                <Check
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                  size={16}
                />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {createOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-5"
          role="presentation"
          onMouseDown={() => !busy && setCreateOpen(false)}
        >
          <Card
            className="w-full max-w-lg p-6 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-team-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
                  New team
                </p>
                <h2
                  id="create-team-title"
                  className="mt-2 text-3xl font-bold tracking-[-.055em]"
                >
                  Create a real team.
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close create team dialog"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                ×
              </Button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              You will become this team’s captain. This creates a real
              pre-season record but no simulation state.
            </p>
            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => void createTeam(event)}
            >
              <label className="grid gap-2 text-xs font-bold text-[var(--ink-muted)]">
                Team name
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="h-10 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs font-bold text-[var(--ink-muted)]">
                Recruitment focus
                <textarea
                  value={focus}
                  maxLength={280}
                  onChange={(event) => setFocus(event.target.value)}
                  className="min-h-28 resize-y rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs font-bold text-[var(--ink-muted)]">
                Capacity
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={capacity}
                  onChange={(event) =>
                    setCapacity(
                      Math.min(
                        12,
                        Math.max(2, Number(event.target.value) || 2),
                      ),
                    )
                  }
                  className="h-10 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {busy ? "Creating…" : "Create team"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </main>
  );
}

function TeamCard({
  team,
  busy,
  applied,
  hasTeam,
  onApply,
}: {
  team: Season1LobbyData["teams"][number];
  busy: boolean;
  applied: boolean;
  hasTeam: boolean;
  onApply: () => void;
}) {
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-base font-black text-[var(--accent)]">
          {team.name[0]}
        </span>
        <Badge
          className={
            team.recruiting
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : ""
          }
        >
          {team.recruiting ? "Recruiting" : "Closed"}
        </Badge>
      </div>
      <h3 className="mt-6 text-xl font-bold tracking-[-.04em]">{team.name}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
        {team.focus || "Recruitment focus has not been added."}
      </p>
      <div className="mt-5 flex justify-between gap-3 border-t border-[var(--line)] pt-4 text-xs font-semibold text-[var(--ink-faint)]">
        <span>
          {team.memberCount} / {team.capacity} members
        </span>
        <span>{team.readyCount} ready</span>
      </div>
      <p className="mt-3 text-xs text-[var(--ink-muted)]">
        {team.applicationCount} pending application
        {team.applicationCount === 1 ? "" : "s"}
      </p>
      <Button
        className="mt-5 w-full"
        disabled={busy || !team.recruiting || hasTeam || applied}
        onClick={onApply}
      >
        {applied
          ? "Application pending"
          : hasTeam
            ? "You already have a team"
            : team.recruiting
              ? "Apply to join"
              : "Recruitment closed"}
      </Button>
    </Card>
  );
}

function Chat({
  title,
  detail,
  messages,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  title: string;
  detail: string;
  messages: Season1LobbyData["messages"];
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <section className="mt-6">
      <p className="text-xs font-bold">{title}</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{detail}</p>
      <ol
        className="mt-4 grid max-h-64 gap-3 overflow-y-auto"
        aria-label={title}
      >
        {messages.map((message) => (
          <li className="flex gap-3" key={message.id}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-[10px] font-black text-[var(--accent)]">
              {message.authorName[0]}
            </span>
            <div>
              <p className="rounded-lg rounded-tl-none bg-[var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[var(--ink-muted)]">
                {message.content}
              </p>
              <p className="mt-1 text-[10px] text-[var(--ink-faint)]">
                {message.authorName}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => void onSubmit(event)}
      >
        <label className="sr-only" htmlFor={`${title}-input`}>
          {title} message
        </label>
        <input
          id={`${title}-input`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          maxLength={1000}
          placeholder="Write a message"
          className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Button type="submit" disabled={disabled}>
          <Send size={15} /> Send
        </Button>
      </form>
    </section>
  );
}

function Status({
  label,
  value,
  green = false,
  amber = false,
}: {
  label: string;
  value: string;
  green?: boolean;
  amber?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm text-white/68">
      <dt>{label}</dt>
      <dd
        className={`m-0 font-bold ${green ? "text-[#9de8c8]" : amber ? "text-[#ffce7c]" : "text-white"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StateCard({
  title,
  detail,
  loading = false,
  retry,
}: {
  title: string;
  detail: string;
  loading?: boolean;
  retry?: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-5">
      <Card className="max-w-xl p-8">
        <div className="flex items-center gap-3 text-[var(--accent)]">
          {loading ? (
            <LoaderCircle className="animate-spin" size={20} />
          ) : (
            <LockKeyhole size={20} />
          )}
          <p className="text-xs font-bold uppercase tracking-[.16em]">
            Season 1
          </p>
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-[-.05em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          {detail}
        </p>
        {retry && (
          <Button className="mt-6" onClick={retry}>
            Try again
          </Button>
        )}
      </Card>
    </main>
  );
}
