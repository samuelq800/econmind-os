"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Globe2,
  Handshake,
  Landmark,
  LineChart,
  LockKeyhole,
  Map,
  Network,
  ReceiptText,
  ShieldAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  WORLD_CLOCK_LABEL,
  WORLD_OFFICE_PATHS,
  WORLD_ROLE_META,
} from "@/lib/world-governance/config";
import {
  allCountries,
  createCountry,
  simulationDate,
  simulationDay,
} from "@/lib/world-governance/simulation";
import type {
  Country,
  WorldGovernanceOffice,
  WorldGovernanceRole,
} from "@/lib/world-governance/types";
import {
  loadWorldGovernanceAccess,
  mayPublishWorldPolicy,
  publishWorldGovernancePolicy,
  type WorldGovernanceAccess,
} from "@/lib/supabase/world-governance";
import { PolicyStudio } from "./policy-studio";
import { WorldMap } from "./world-map";

const roleIcon: Record<WorldGovernanceRole, typeof Landmark> = {
  captain: Landmark,
  "central-bank": CircleDollarSign,
  finance: ReceiptText,
  trade: Handshake,
  industry: Wrench,
  social: UsersRound,
};

const conditionCopy: Record<Country["condition"], string> = {
  normal: "Stable operating conditions",
  vulnerable: "Vulnerable: monitor shared resources",
  protest: "Protest risk: legitimacy and household pressure need attention",
  government_crisis: "Government crisis: only reversible actions can begin",
  institutional_collapse: "Institutional collapse: no new discretionary policy",
  empty_state: "No active government: defaults, contracts and decay continue",
  recovery: "Recovery: permissions return gradually with cross-office support",
};

type AccessState = WorldGovernanceAccess & { ready: boolean; error?: string };

function useWorldAccess() {
  const { user, worldSupervisor, configured } = useAuth();
  const [access, setAccess] = useState<AccessState>({
    world: null,
    roles: [],
    ready: false,
  });
  useEffect(() => {
    let mounted = true;
    if (!configured)
      return () => {
        mounted = false;
      };
    void loadWorldGovernanceAccess(user?.id).then(
      (result) => {
        if (mounted) setAccess({ ...result, ready: true });
      },
      (error: unknown) => {
        if (mounted)
          setAccess({
            world: null,
            roles: [],
            ready: true,
            error:
              error instanceof Error
                ? error.message
                : "World data is temporarily unavailable.",
          });
      },
    );
    return () => {
      mounted = false;
    };
  }, [configured, user?.id]);
  return {
    access: configured ? access : { ...access, ready: true },
    worldSupervisor,
    configured,
    user,
  };
}

function formatSimulationDate() {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(simulationDate());
}

function PageFrame({
  children,
  countryId,
  office,
  basePath = "/league/world",
  systemLabel = "EconMind OS League",
}: {
  children: ReactNode;
  countryId?: string;
  office?: WorldGovernanceOffice;
  basePath?: string;
  systemLabel?: string;
}) {
  return (
    <>
      <WorldStatusBar />
      <div className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8">
        {countryId ? (
          <WorldSubnav countryId={countryId} office={office} basePath={basePath} />
        ) : (
          <WorldTopNav basePath={basePath} systemLabel={systemLabel} />
        )}
        {children}
      </div>
    </>
  );
}

export function WorldStatusBar() {
  const now = new Date();
  return (
    <div className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1540px] items-center gap-3 overflow-x-auto px-4 py-2.5 text-[10px] sm:px-6 lg:px-8">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-bold text-[var(--accent)]">
          <Globe2 size={13} /> Persistent World
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 font-semibold text-[var(--ink-muted)]">
          <Clock3 size={12} /> Day {simulationDay()} · {formatSimulationDate()}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 font-semibold text-[var(--ink-muted)]">
          <Activity size={12} /> {WORLD_CLOCK_LABEL}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent)]">
          <span className="size-1.5 animate-pulse rounded-full bg-current" />{" "}
          Running continuously
        </span>
        <span className="hidden shrink-0 text-[var(--ink-faint)] lg:inline">
          System reference:{" "}
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function WorldTopNav({ basePath, systemLabel }: { basePath: string; systemLabel: string }) {
  return (
    <nav
      aria-label="World simulation navigation"
      className="mb-5 flex flex-wrap items-center justify-between gap-3"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          {systemLabel}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">
          World Simulation
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${basePath}/contracts`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <Handshake size={14} /> Contracts
        </Link>
        <Link
          href={`${basePath}/diplomacy`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <Network size={14} /> Diplomacy
        </Link>
        <Link
          href={`${basePath}/leaderboard`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <LineChart size={14} /> Leaderboard
        </Link>
      </div>
    </nav>
  );
}

function WorldSubnav({
  countryId,
  office,
  basePath,
}: {
  countryId: string;
  office?: WorldGovernanceOffice;
  basePath: string;
}) {
  const country = createCountry(countryId);
  return (
    <nav
      aria-label="Country workspace navigation"
      className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow)]"
    >
      <div className="flex min-w-max items-center gap-1 overflow-x-auto">
        <Link
          href={basePath}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <ArrowLeft size={14} /> World
        </Link>
        <Link
          href={`${basePath}/country/${countryId}`}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold ${!office ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
        >
          <span className="size-2 rounded-full bg-[var(--accent)]" />{" "}
          {country.name}
        </Link>
        <span className="h-6 w-px bg-[var(--line)]" />
        {WORLD_OFFICE_PATHS.map((item) => {
          const label =
            item === "central-bank"
              ? "Central Bank"
              : item[0].toUpperCase() + item.slice(1);
          return (
            <Link
              key={item}
              href={`${basePath}/country/${countryId}/${item}`}
              className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold whitespace-nowrap ${office === item ? "bg-[var(--accent)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ResourceStrip({ country }: { country: Country }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
      {country.resources.map((resource) => (
        <div
          key={resource.id}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
        >
          <p className="truncate text-[9px] font-bold uppercase tracking-[.1em] text-[var(--ink-faint)]">
            {resource.label}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <strong className="text-base">{resource.value.toFixed(0)}</strong>
            <span
              className={`size-2 rounded-full ${resource.risk === "normal" ? "bg-[var(--accent)]" : resource.risk === "watch" ? "bg-[var(--amber)]" : "bg-[var(--red)]"}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficeCard({
  countryId,
  role,
  assigned,
  supervisor,
  basePath,
}: {
  countryId: string;
  role: WorldGovernanceRole;
  assigned: boolean;
  supervisor: boolean;
  basePath: string;
}) {
  const meta = WORLD_ROLE_META[role];
  const Icon = roleIcon[role];
  return (
    <Link
      href={`${basePath}/country/${countryId}/${role}`}
      className="group rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon size={17} />
        </span>
        {assigned || supervisor ? (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-bold text-[var(--accent)]">
            Office access
          </span>
        ) : (
          <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[9px] font-bold text-[var(--ink-faint)]">
            Explore
          </span>
        )}
      </div>
      <h3 className="mt-4 text-sm font-bold">{meta.title}</h3>
      <p className="mt-1 min-h-10 text-xs leading-5 text-[var(--ink-muted)]">
        {meta.description}
      </p>
      <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-[var(--ink-faint)]">
        <span>{meta.kpis.join(" · ")}</span>
        <ChevronRight
          size={14}
          className="text-[var(--accent)] transition group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}

function AccessNotice({ countryId }: { countryId: string }) {
  const { access, user, configured } = useWorldAccess();
  const assigned = access.roles.filter((role) => role.countryId === countryId);
  if (!configured)
    return (
      <Card className="border-[var(--amber)] bg-[var(--amber-soft)] p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--amber)]">
          <AlertTriangle size={16} /> Supabase environment is not configured in
          this build.
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          You can inspect the teaching simulation locally; participation is
          enabled when the deployed publishable environment variables are
          present.
        </p>
      </Card>
    );
  if (!user)
    return (
      <Card className="border-[var(--amber)] bg-[var(--amber-soft)] p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--amber)]">
          <LockKeyhole size={16} /> Register and join the League to participate.
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          World information remains visible, but saving policy, contracts and
          country roles requires a personal account and League membership.
        </p>
        <Link
          href="/league/join"
          className="mt-3 inline-flex text-xs font-bold text-[var(--accent)]"
        >
          Open League registration <ChevronRight size={13} />
        </Link>
      </Card>
    );
  if (!assigned.length)
    return (
      <Card className="border-[var(--line)] bg-[var(--surface-subtle)] p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <UsersRound size={16} className="text-[var(--accent)]" /> This account
          has no office in {createCountry(countryId).name}.
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          Choose or request a country office in the League. One registered
          account can hold several offices; each office retains its own
          authority and audit trail.
        </p>
        <Link
          href="/league/join"
          className="mt-3 inline-flex text-xs font-bold text-[var(--accent)]"
        >
          Manage League membership <ChevronRight size={13} />
        </Link>
      </Card>
    );
  return null;
}

export function WorldSimulationOverview({
  basePath = "/league/world",
  systemLabel = "EconMind OS League",
}: {
  basePath?: string;
  systemLabel?: string;
} = {}) {
  const [mode, setMode] = useState<
    "political" | "trade" | "risk" | "resources"
  >("political");
  const { access, user } = useWorldAccess();
  const countries = allCountries();
  const assignedCountryCount = new Set(
    access.roles.map((item) => item.countryId),
  ).size;
  return (
    <PageFrame basePath={basePath} systemLabel={systemLabel}>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Card className="overflow-hidden border-[var(--accent)] p-0">
            <div className="relative px-5 py-6 sm:px-7 sm:py-8">
              <div className="absolute inset-0 page-grid opacity-20" />
              <div className="relative">
                <Badge className="border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  12 fictional countries · Persistent simulation
                </Badge>
                <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-[-.055em] sm:text-4xl">
                  A world that continues between decisions.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
                  There are no Q1 locks or round resets. Once a country is
                  staffed, its policies, contracts, projects, household
                  conditions and shocks evolve with natural simulated time.
                  Unclaimed countries continue under conservative default
                  settings.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href="#countries"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white"
                  >
                    <Map size={15} /> Select a country
                  </Link>
                  <Link
                    href={`${basePath}/contracts`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold"
                  >
                    <Handshake size={15} /> Contract desk
                  </Link>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-[var(--line)] sm:grid-cols-4">
              {[
                ["12", "countries"],
                ["6", "offices / country"],
                ["2h", "per simulation day"],
                ["30d", "rolling briefing"],
              ].map(([number, label], index) => (
                <div
                  key={label}
                  className={`px-5 py-4 ${index ? "border-l border-[var(--line)]" : ""}`}
                >
                  <p className="text-xl font-bold text-[var(--accent)]">
                    {number}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <WorldMap mode={mode} onModeChange={setMode} basePath={basePath} />
          <section id="countries">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">
                  Country selection
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Enter a national workspace
                </h2>
              </div>
              <p className="max-w-md text-right text-xs leading-5 text-[var(--ink-muted)]">
                Selecting a country does not claim it. Participation remains
                gated by your League membership and office assignment.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {countries.map((country) => (
                <Link
                  key={country.id}
                  href={`${basePath}/country/${country.id}`}
                  className="group rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                        {country.flag}
                      </span>
                      <h3 className="text-base font-bold">{country.name}</h3>
                    </div>
                    <ChevronRight size={16} className="text-[var(--accent)]" />
                  </div>
                  <p className="mt-2 text-xs text-[var(--ink-muted)]">
                    {conditionCopy[country.condition]}
                  </p>
                  <div className="mt-4 flex gap-2 text-[10px] font-bold text-[var(--ink-faint)]">
                    <span>
                      Stability{" "}
                      {country.resources
                        .find((item) => item.id === "national_stability")
                        ?.value.toFixed(0)}
                    </span>
                    <span>·</span>
                    <span>
                      Fiscal space{" "}
                      {country.resources
                        .find((item) => item.id === "fiscal_space")
                        ?.value.toFixed(0)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
              Your world access
            </p>
            {access.ready ? (
              <>
                <h2 className="mt-1 text-xl font-bold">
                  {user ? "League workspace" : "Read-only preview"}
                </h2>
                <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                  {user
                    ? `You currently hold ${access.roles.length} office assignment${access.roles.length === 1 ? "" : "s"} across ${assignedCountryCount} countr${assignedCountryCount === 1 ? "y" : "ies"}.`
                    : "Register a personal account, then choose an existing school, submit a school for approval, or remain a visitor."}
                </p>
                {access.error ? (
                  <p className="mt-3 rounded-lg bg-[var(--red-soft)] px-3 py-2 text-xs text-[var(--red)]">
                    Live access will reconnect when the world database is
                    available.
                  </p>
                ) : null}
                <Link
                  href="/league/join"
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-bold text-white"
                >
                  {user ? "Manage membership" : "Register & join League"}
                  <ChevronRight size={14} />
                </Link>
              </>
            ) : (
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                Checking permissions…
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
              World rules
            </p>
            <ul className="mt-3 space-y-3 text-xs leading-5 text-[var(--ink-muted)]">
              <li className="flex gap-2">
                <Clock3
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                />
                Policies do not instantly become outcomes: each has a delay,
                ramp, peak and decay.
              </li>
              <li className="flex gap-2">
                <ShieldAlert
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                />
                No country can purchase a free result. Fiscal, reserve, capacity
                and legitimacy constraints remain visible.
              </li>
              <li className="flex gap-2">
                <BookOpenCheck
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--accent)]"
                />
                Ranges show transparent teaching calibration, not a prediction
                or claimed real-world causal estimate.
              </li>
            </ul>
          </Card>
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
              Compact timeline
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
              The system retains policies, contracts, crises and rolling 30-day
              reports for review. It does not expose rollback snapshots that
              could rewrite the running world.
            </p>
            <Link
              href={`${basePath}/leaderboard`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
            >
              Open reports & rankings <ChevronRight size={13} />
            </Link>
          </Card>
        </aside>
      </section>
    </PageFrame>
  );
}

export function CountrySimulationWorkspace({
  countryId,
  basePath = "/league/world",
}: {
  countryId: string;
  basePath?: string;
}) {
  const country = createCountry(countryId);
  const { access, worldSupervisor } = useWorldAccess();
  return (
    <PageFrame countryId={countryId} basePath={basePath}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,var(--surface),var(--accent-soft))] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">
                {country.flag} National workspace
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-[-.05em]">
                {country.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                {conditionCopy[country.condition]}. Enter one office to make a
                governed policy draft, coordinate a cabinet package or inspect
                the country’s continuous position.
              </p>
            </div>
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--ink-muted)]">
              Day {simulationDay()} · ongoing
            </span>
          </div>
          <div className="mt-5">
            <ResourceStrip country={country} />
          </div>
        </section>
        <AccessNotice countryId={countryId} />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(WORLD_ROLE_META) as WorldGovernanceRole[]).map(
            (role) => (
              <OfficeCard
                key={role}
                countryId={countryId}
                role={role}
                assigned={access.roles.some(
                  (item) => item.countryId === countryId && item.role === role,
                )}
                supervisor={worldSupervisor}
                basePath={basePath}
              />
            ),
          )}
        </section>
        <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <WorldMap selectedCountryId={countryId} compact basePath={basePath} />
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">
              Country briefing
            </p>
            <h2 className="mt-1 text-xl font-bold">
              Start with a diagnosis, not a lever.
            </h2>
            <div className="mt-4 space-y-3">
              {country.indicators.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-[var(--line)] pb-3 text-sm last:border-0 last:pb-0"
                >
                  <span className="text-[var(--ink-muted)]">{item.label}</span>
                  <span className="font-mono font-bold">
                    {item.value.toFixed(1)} {item.unit}
                    <small
                      className={`ml-2 text-[10px] ${item.change > 0 ? "text-[var(--accent)]" : item.change < 0 ? "text-[var(--red)]" : "text-[var(--ink-faint)]"}`}
                    >
                      {item.change > 0 ? "+" : ""}
                      {item.change.toFixed(1)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <Link
              href={`${basePath}/country/${countryId}/reports`}
              className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
            >
              Open rolling briefing <ChevronRight size={13} />
            </Link>
          </Card>
        </section>
      </div>
    </PageFrame>
  );
}

function OfficeHeader({
  country,
  role,
  basePath,
}: {
  country: Country;
  role: WorldGovernanceRole;
  basePath: string;
}) {
  const Icon = roleIcon[role];
  const meta = WORLD_ROLE_META[role];
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon size={21} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">
              {country.name} · {meta.shortTitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-.04em]">
              {meta.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
              {meta.description}
            </p>
          </div>
        </div>
        <Link
          href={`${basePath}/country/${country.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <Map size={14} /> Country overview
        </Link>
      </div>
    </section>
  );
}

function CabinetWorkspace({ country, basePath }: { country: Country; basePath: string }) {
  const roles = Object.keys(WORLD_ROLE_META) as WorldGovernanceRole[];
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Cabinet coordination
        </p>
        <h2 className="mt-1 text-xl font-bold">
          One diagnosis, several accountable owners.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          Cabinet is the place to assemble cross-office proposals. It cannot
          bypass office authority: each minister publishes their own instrument
          and the Captain resolves conflicts or approves threshold cases.
        </p>
        <div className="mt-5 space-y-3">
          {roles.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3"
            >
              <div>
                <p className="text-sm font-bold">
                  {WORLD_ROLE_META[role].shortTitle}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {WORLD_ROLE_META[role].kpis.join(" · ")}
                </p>
              </div>
              <Link
                href={`${basePath}/country/${country.id}/${role}`}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 text-xs font-bold text-[var(--accent)]"
              >
                Open desk <ChevronRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Approval queue
        </p>
        <h2 className="mt-1 text-lg font-bold">Automatic Captain review</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
          A package automatically routes to the Captain when its direct fiscal
          cost exceeds 4% GDP, reserve use exceeds 20%, or political capital
          cost exceeds 40%. Other named co-signatures still apply.
        </p>
        <div className="mt-4 space-y-2">
          <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-3 text-xs">
            <strong className="block">No pending cross-office package</strong>
            <span className="mt-1 block text-[var(--ink-muted)]">
              Publish a ministry draft to create an auditable approval item.
            </span>
          </div>
          <Link
            href={`${basePath}/country/${country.id}/policies`}
            className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-[var(--accent)]"
          >
            Inspect policy register <ChevronRight size={13} />
          </Link>
        </div>
      </Card>
    </section>
  );
}

function ReportsWorkspace({ country }: { country: Country }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Rolling 30-day briefing
        </p>
        <h2 className="mt-1 text-xl font-bold">
          {country.name}: current evidence trail
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          A report is generated from the running state, active policy
          lifecycles, contract settlements and alerts. It supports review and
          learning; it cannot rewind the world.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {country.resources.slice(0, 6).map((resource) => (
            <div
              key={resource.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-[.11em] text-[var(--ink-faint)]">
                {resource.label}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {resource.value.toFixed(0)}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {resource.explanation}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Learning explanation
        </p>
        <h2 className="mt-1 text-lg font-bold">Why did the system move?</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
          Each report labels what is observed in the simulation, what is a
          policy calibration and what remains uncertain. Model-based direction
          never becomes a claim of certainty.
        </p>
        <Link
          href="/models"
          className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]"
        >
          Open model library <ChevronRight size={13} />
        </Link>
      </Card>
    </section>
  );
}

function PolicyRegister({ country }: { country: Country }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          National policy register
        </p>
        <h2 className="mt-1 text-xl font-bold">
          Lifecycle-aware, append-only decisions
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          This register will show every policy after publication: announcement,
          waiting period, ramp-up, full effect, fade, expiry, cancellation or
          block. Changing direction does not edit the past; it creates a new
          reversal event.
        </p>
        <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-subtle)] p-5 text-center">
          <FileText size={20} className="mx-auto text-[var(--accent)]" />
          <p className="mt-2 text-sm font-bold">
            No published policy is currently displayed.
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            Use an assigned office’s policy desk to publish the first governed
            action for {country.name}.
          </p>
        </div>
      </Card>
      <Card className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Lifecycle rules
        </p>
        <ul className="mt-3 space-y-3 text-xs leading-5 text-[var(--ink-muted)]">
          <li>
            <strong className="text-[var(--ink)]">Waiting / ramping:</strong> a
            published decision is visible but may not yet have any effective
            strength.
          </li>
          <li>
            <strong className="text-[var(--ink)]">Full effect / fading:</strong>{" "}
            calibrated effects are weighted once per tick, avoiding compounding.
          </li>
          <li>
            <strong className="text-[var(--ink)]">Reversal:</strong> the former
            version is cancelled, credibility is affected and the new policy
            gets its own lifecycle.
          </li>
        </ul>
      </Card>
    </section>
  );
}

export function WorldOfficeWorkspace({
  countryId,
  office,
  basePath = "/league/world",
}: {
  countryId: string;
  office: WorldGovernanceOffice;
  basePath?: string;
}) {
  const country = createCountry(countryId);
  const { access, worldSupervisor } = useWorldAccess();
  if (office === "cabinet")
    return (
      <PageFrame countryId={countryId} office={office} basePath={basePath}>
        <div className="space-y-5">
          <OfficeHeader country={country} role="captain" basePath={basePath} />
          <CabinetWorkspace country={country} basePath={basePath} />
        </div>
      </PageFrame>
    );
  if (office === "reports")
    return (
      <PageFrame countryId={countryId} office={office} basePath={basePath}>
        <div className="space-y-5">
          <OfficeHeader country={country} role="captain" basePath={basePath} />
          <ReportsWorkspace country={country} />
        </div>
      </PageFrame>
    );
  if (office === "policies")
    return (
      <PageFrame countryId={countryId} office={office} basePath={basePath}>
        <div className="space-y-5">
          <OfficeHeader country={country} role="captain" basePath={basePath} />
          <PolicyRegister country={country} />
        </div>
      </PageFrame>
    );
  const role = office as WorldGovernanceRole;
  const hasAuthority =
    Boolean(access.world) &&
    mayPublishWorldPolicy(access, countryId, role, worldSupervisor);
  return (
    <PageFrame countryId={countryId} office={office} basePath={basePath}>
      <div className="space-y-5">
        <OfficeHeader country={country} role={role} basePath={basePath} />
        <ResourceStrip country={country} />
        <PolicyStudio
          role={role}
          canPublish={hasAuthority}
          onPublish={async (policyId, value) => {
            if (!access.world)
              throw new Error("The continuous world is not available yet.");
            await publishWorldGovernancePolicy({
              worldId: access.world.id,
              countryId,
              policyId,
              value,
            });
          }}
        />
      </div>
    </PageFrame>
  );
}

function SecondaryHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
        {description}
      </p>
    </section>
  );
}

export function WorldContractsPage({
  basePath = "/league/world",
  systemLabel = "EconMind OS League",
}: {
  basePath?: string;
  systemLabel?: string;
} = {}) {
  const pairs = [
    ["Asterra", "Lumeria", "Food supply"],
    ["Cyrenia", "Bellune", "Energy & equipment"],
    ["Eryndor", "Iskara", "Port logistics"],
  ];
  return (
    <PageFrame basePath={basePath} systemLabel={systemLabel}>
      <SecondaryHeader
        eyebrow="International contract desk"
        title="Trade that settles even when governments change."
        description="Contracts are bilateral ledgers: they track terms, acceptance, shipments, invoice dates, breaches, dispute steps and default. An unclaimed country applies the standard-contract default rather than freezing the network."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Contract templates</h2>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Choose a preconfigured, explainable template; amendments remain
                auditable.
              </p>
            </div>
            <Button size="sm">
              <Handshake size={14} /> New proposal
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {pairs.map(([exporter, importer, market], index) => (
              <div
                key={`${exporter}-${importer}`}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">
                      {market} supply agreement
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {exporter} → {importer} · delivery, payment and dispute
                      terms are visible to both parties.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${index === 1 ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}
                  >
                    {index === 1 ? "Awaiting approval" : "Standard default"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-[var(--ink-faint)]">
                  <span className="rounded bg-[var(--surface)] px-2 py-1">
                    Settlement every 14d
                  </span>
                  <span className="rounded bg-[var(--surface)] px-2 py-1">
                    Partial delivery supported
                  </span>
                  <span className="rounded bg-[var(--surface)] px-2 py-1">
                    No double close-out
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
            Safeguards
          </p>
          <ul className="mt-3 space-y-3 text-xs leading-5 text-[var(--ink-muted)]">
            <li>
              <strong className="text-[var(--ink)]">
                Draft → sent → counteroffer → approval:
              </strong>{" "}
              neither party is silently committed.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Default ≠ deletion:</strong>{" "}
              arrears, collateral and restructuring remain visible in the
              ledger.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Default policy:</strong> an
              unclaimed counterpart automatically accepts only a normal,
              preconfigured contract.
            </li>
          </ul>
        </Card>
      </div>
    </PageFrame>
  );
}

export function WorldDiplomacyPage({
  basePath = "/league/world",
  systemLabel = "EconMind OS League",
}: {
  basePath?: string;
  systemLabel?: string;
} = {}) {
  return (
    <PageFrame basePath={basePath} systemLabel={systemLabel}>
      <SecondaryHeader
        eyebrow="Foreign relations"
        title="Relationships, exposure and negotiation"
        description="The diplomacy layer turns trade routes into visible dependencies. It distinguishes a proposed deal from an accepted contract and keeps non-financial political consequences explicit."
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <WorldMap mode="trade" basePath={basePath} />
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
            Relationship ledger
          </p>
          <h2 className="mt-1 text-xl font-bold">Network signals</h2>
          <div className="mt-4 space-y-3">
            {[
              ["Route reliability", "72", "Watch"],
              ["Strategic dependence", "41", "Managed"],
              ["Active counterparties", "9", "Normal"],
              ["Open disputes", "1", "Review"],
            ].map(([label, value, status]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-[var(--line)] pb-3 text-sm last:border-0"
              >
                <span className="text-[var(--ink-muted)]">{label}</span>
                <span className="font-bold">
                  {value}{" "}
                  <small className="ml-1 text-[10px] text-[var(--ink-faint)]">
                    {status}
                  </small>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-[var(--surface-subtle)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
            A relationship index is a teaching signal based on routes, contract
            performance and announced policy. It is not a judgement of a real
            country or institution.
          </p>
        </Card>
      </div>
    </PageFrame>
  );
}

export function WorldLeaderboardPage({
  basePath = "/league/world",
  systemLabel = "EconMind OS League",
}: {
  basePath?: string;
  systemLabel?: string;
} = {}) {
  const countries = allCountries().sort(
    (a, b) =>
      (b.resources.find((item) => item.id === "national_stability")?.value ??
        0) -
      (a.resources.find((item) => item.id === "national_stability")?.value ??
        0),
  );
  return (
    <PageFrame basePath={basePath} systemLabel={systemLabel}>
      <SecondaryHeader
        eyebrow="Scoreboard & review"
        title="National performance, role contribution and risk"
        description="National score accounts for 70% and role contribution 30%. Rankings are a learning aid: their explanation is always more important than their position."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[52px_minmax(0,1fr)_90px_90px] gap-3 border-b border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--ink-faint)]">
            <span>#</span>
            <span>Country</span>
            <span className="text-right">National</span>
            <span className="text-right">Risk</span>
          </div>
          {countries.map((country, index) => {
            const stability =
              country.resources.find((item) => item.id === "national_stability")
                ?.value ?? 0;
            const score = Math.round(
              stability * 0.45 +
                (country.resources.find((item) => item.id === "fiscal_space")
                  ?.value ?? 0) *
                  0.25 +
                (country.resources.find((item) => item.id === "public_support")
                  ?.value ?? 0) *
                  0.3,
            );
            return (
              <Link
                href={`${basePath}/country/${country.id}/reports`}
                key={country.id}
                className="grid grid-cols-[52px_minmax(0,1fr)_90px_90px] items-center gap-3 border-b border-[var(--line)] px-4 py-3.5 text-sm last:border-0 hover:bg-[var(--surface-subtle)]"
              >
                <span className="font-mono text-[var(--ink-faint)]">
                  {index + 1}
                </span>
                <span>
                  <strong className="block">{country.name}</strong>
                  <small className="text-[10px] text-[var(--ink-muted)]">
                    {conditionCopy[country.condition]}
                  </small>
                </span>
                <strong className="text-right font-mono text-[var(--accent)]">
                  {score}
                </strong>
                <span className="text-right text-xs text-[var(--ink-muted)]">
                  {stability < 35
                    ? "High"
                    : stability < 50
                      ? "Watch"
                      : "Managed"}
                </span>
              </Link>
            );
          })}
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
            Score interpretation
          </p>
          <h2 className="mt-1 text-lg font-bold">No single-metric winner</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
            The national component considers resilience, fiscal position,
            price/livelihood signals and execution quality. Role score measures
            whether a portfolio used its authority responsibly, not simply
            whether it produced the largest short-run movement.
          </p>
          <p className="mt-4 rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
            A high score never overrides collapse, arrears or unserved
            households. Extreme policies can raise one metric while worsening
            the country’s overall condition.
          </p>
        </Card>
      </div>
    </PageFrame>
  );
}
