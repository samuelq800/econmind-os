"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Crown,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { competitionFit as fit } from "@/lib/competition/fit";
import {
  addCompetitionNeed,
  addCompetitionPlaceholder,
  applyToCompetitionTeam,
  blockCompetitionUser,
  createCompetitionTeam,
  getCompetitionHome,
  getCompetitionLounge,
  inviteCompetitionPlayer,
  leaveCompetitionTeam,
  markCompetitionNotificationsRead,
  openCompetitionContext,
  postCompetitionMessage,
  postCompetitionLobbyMessage,
  postCompetitionRecruitment,
  removeCompetitionPlaceholder,
  reportCompetitionContent,
  resolveCompetitionRequest,
  saveAcademicProfile,
  saveMatchingProfile,
  setCompetitionRecruiting,
  transferCompetitionTeam,
  withdrawCompetitionRequest,
  type AcademicProfile,
  type CompetitionHome,
  type CompetitionLounge,
  type CompetitionRule,
  type Player,
  type Team,
} from "@/lib/supabase/competition-matching";

const emptyAcademic: AcademicProfile = {
  country: "",
  location: "",
  curriculum: "",
  curriculum_detail: {},
  graduation_year: null,
  gpa: null,
  gpa_scale: "",
  gpa_system: "",
  english_tests: [],
  standardized_tests: [],
  amc_records: [],
  competition_records: [],
  visibility: {
    school: "public",
    gpa: "matches",
    economics: "public",
    english_tests: "matches",
    standardized_tests: "matches",
    amc_records: "matches",
    competition_records: "public",
  },
  bio: "",
};
const strengthOptions = [
  "Microeconomics",
  "Macroeconomics",
  "Quantitative",
  "Data Analysis",
  "Competition Experience",
  "Research",
  "Writing",
  "Presentation",
  "Strategy",
  "Leadership",
];
const areaLinks = [
  ["/competition/lobby", "Overview"],
  ["/competition/lobby/teams", "Teams"],
  ["/competition/lobby/players", "Players"],
  ["/competition/team", "My Team"],
  ["/competition/lobby/requests", "Requests"],
  ["/competition/lobby/lounge", "Lounge"],
];

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
function Tags({ values }: { values: string[] }) {
  return (
    <div className="cm-tags">
      {values.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="cm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

type AcademicRecordKind =
  | "english_tests"
  | "standardized_tests"
  | "amc_records"
  | "competition_records";
const recordOptions: Record<AcademicRecordKind, string[]> = {
  english_tests: ["IELTS", "TOEFL"],
  standardized_tests: ["SAT", "ACT"],
  amc_records: ["AMC 10", "AMC 12"],
  competition_records: ["NEC", "IEO", "Other"],
};
function AcademicRecordEditor({
  kind,
  records,
  onChange,
  rules,
}: {
  kind: AcademicRecordKind;
  records: unknown[];
  onChange: (records: unknown[]) => void;
  rules: CompetitionRule[];
}) {
  const [draft, setDraft] = useState<Record<string, string>>({
    name: recordOptions[kind][0],
    year: "2026",
    score: "",
    division: "",
    stage: "",
    achievement: "",
  });
  const fields =
    kind === "competition_records"
      ? []
      : kind === "english_tests"
        ? ["score", "reading", "listening", "speaking", "writing"]
        : kind === "amc_records"
          ? ["score", "aime"]
          : ["score"];
  return (
    <div className="cm-record-editor">
      <h3>{kind.replaceAll("_", " ")}</h3>
      <div className="cm-record-list">
        {records.map((record, index) => (
          <div key={index}>
            <span>
              {Object.entries(
                (record && typeof record === "object" ? record : {}) as Record<
                  string,
                  unknown
                >,
              )
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(" · ")}
            </span>
            <button
              type="button"
              aria-label="Remove record"
              onClick={() =>
                onChange(records.filter((_, item) => item !== index))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="cm-form-grid">
        <Field label="Exam / competition">
          <select
            value={draft.name}
            onChange={(event) =>
              setDraft({
                ...draft,
                name: event.target.value,
                division: "",
                stage: "",
                achievement: "",
              })
            }
          >
            {recordOptions[kind].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <input
            type="number"
            min="2000"
            max="2050"
            value={draft.year}
            onChange={(event) =>
              setDraft({ ...draft, year: event.target.value })
            }
          />
        </Field>
        {kind === "competition_records" && (
          <>
            {draft.name === "Other" && (
              <Field label="Competition name">
                <input
                  required
                  value={draft.customName ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, customName: event.target.value })
                  }
                />
              </Field>
            )}
            <Field label="Division / category">
              {draft.name === "Other" ? (
                <input
                  value={draft.division ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, division: event.target.value })
                  }
                />
              ) : (
                <select
                  value={draft.division ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, division: event.target.value })
                  }
                >
                  <option value="">Select division</option>
                  {rules
                    .filter((rule) => rule.competition === draft.name)
                    .map((rule) => (
                      <option key={rule.division} value={rule.division}>
                        {rule.division}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field label="Stage">
              {draft.name === "Other" ? (
                <input
                  value={draft.stage ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, stage: event.target.value })
                  }
                />
              ) : (
                <select
                  value={draft.stage ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, stage: event.target.value })
                  }
                >
                  <option value="">Select stage</option>
                  {Array.from(
                    new Set(
                      rules
                        .filter((rule) => rule.competition === draft.name)
                        .flatMap((rule) => rule.stages),
                    ),
                  ).map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Achievement">
              {draft.name === "Other" ? (
                <input
                  value={draft.achievement ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, achievement: event.target.value })
                  }
                />
              ) : (
                <select
                  value={draft.achievement ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, achievement: event.target.value })
                  }
                >
                  <option value="">Select achievement</option>
                  {Array.from(
                    new Set(
                      rules
                        .filter((rule) => rule.competition === draft.name)
                        .flatMap((rule) => rule.awards),
                    ),
                  ).map((award) => (
                    <option key={award}>{award}</option>
                  ))}
                </select>
              )}
            </Field>
            {(draft.stage === "Other" || draft.achievement === "Other") && (
              <Field label="Custom stage or award">
                <input
                  value={draft.customAward ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, customAward: event.target.value })
                  }
                />
              </Field>
            )}
          </>
        )}
        {fields.map((field) => (
          <Field key={field} label={field}>
            <input
              value={draft[field] ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, [field]: event.target.value })
              }
              placeholder={field === "aime" ? "Qualification / score" : field}
            />
          </Field>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          onChange([
            ...records,
            Object.fromEntries(
              Object.entries(draft).filter(
                ([key, value]) =>
                  value &&
                  (key === "name" ||
                    key === "year" ||
                    fields.includes(key) ||
                    kind === "competition_records"),
              ),
            ),
          ]);
          setDraft({
            name: recordOptions[kind][0],
            year: "2026",
            score: "",
            division: "",
            stage: "",
            achievement: "",
          });
        }}
      >
        Add record
      </Button>
    </div>
  );
}

export function CompetitionApp() {
  const { user, loading: authLoading, roleLoading, openAuth } = useAuth();
  const pathname = usePathname() ?? "/competition";
  const router = useRouter();
  const [data, setData] = useState<CompetitionHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState("NEC");
  const [selectedDivision, setSelectedDivision] = useState("AS");
  const [status, setStatus] = useState("looking_for_team");
  const [target, setTarget] = useState("");
  const [curriculumPreference, setCurriculumPreference] = useState("any");
  const [economicsPreference, setEconomicsPreference] = useState("any");
  const [experiencePreference, setExperiencePreference] = useState("any");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [academic, setAcademic] = useState<AcademicProfile>(emptyAcademic);
  const [teamName, setTeamName] = useState("");
  const [teamIntro, setTeamIntro] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [chosenTeam, setChosenTeam] = useState<Team | null>(null);
  const [chosenPlayer, setChosenPlayer] = useState<Player | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [placeholderName, setPlaceholderName] = useState("");
  const [placeholderSchool, setPlaceholderSchool] = useState("");
  const [chosenPlaceholder, setChosenPlaceholder] = useState("");
  const [needNote, setNeedNote] = useState("");
  const [lounge, setLounge] = useState<CompetitionLounge | null>(null);
  const [recruitmentNote, setRecruitmentNote] = useState("");
  const [lobbyMessage, setLobbyMessage] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(
    async (competition?: string, division?: string, page = 0, query = "") => {
      if (!user) return;
      const request = ++latestRequest.current;
      try {
        const next = await getCompetitionHome(
          competition,
          division,
          page,
          query,
        );
        if (request !== latestRequest.current) return;
        setData(next);
        setAcademic(
          next.academic
            ? { ...emptyAcademic, ...next.academic }
            : { ...emptyAcademic, location: next.identity?.city ?? "" },
        );
        setError("");
      } catch (caught) {
        if (request !== latestRequest.current) return;
        setData(null);
        setError(message(caught));
      } finally {
        if (request === latestRequest.current) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (authLoading || roleLoading) return;
    const timer = window.setTimeout(() => {
      if (user) void refresh();
      else setLoading(false);
    }, 0);
    return () => {
      latestRequest.current += 1;
      window.clearTimeout(timer);
    };
  }, [authLoading, roleLoading, user, refresh]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim().toLowerCase()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  const activeCompetition = data?.context?.competition;
  const activeDivision = data?.context?.division;
  useEffect(() => {
    if (
      !user ||
      !activeCompetition ||
      !activeDivision ||
      !(pathname.endsWith("/teams") || pathname.endsWith("/players"))
    )
      return;
    const timer = window.setTimeout(() => {
      setOffset(0);
      void refresh(activeCompetition, activeDivision, 0, debouncedSearch);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    debouncedSearch,
    pathname,
    activeCompetition,
    activeDivision,
    user,
    refresh,
  ]);
  useEffect(() => {
    if (
      !user ||
      !activeCompetition ||
      !activeDivision ||
      pathname.includes("/profile") ||
      pathname.includes("/select")
    )
      return;
    const update = () => {
      if (document.visibilityState === "visible")
        void refresh(
          activeCompetition,
          activeDivision,
          offset,
          pathname.endsWith("/teams") || pathname.endsWith("/players")
            ? debouncedSearch
            : "",
        );
    };
    const interval = window.setInterval(update, 20_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [
    user,
    activeCompetition,
    activeDivision,
    pathname,
    offset,
    debouncedSearch,
    refresh,
  ]);
  useEffect(() => {
    if (
      !user ||
      !activeCompetition ||
      !activeDivision ||
      !pathname.includes("/lounge")
    )
      return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getCompetitionLounge(
          activeCompetition,
          activeDivision,
        );
        if (!cancelled) setLounge(result);
      } catch (caught) {
        if (!cancelled) setError(message(caught));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, activeCompetition, activeDivision, pathname]);

  async function act(
    action: () => Promise<unknown>,
    success: string,
    destination?: string,
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh(data?.context?.competition, data?.context?.division);
      setNotice(success);
      if (destination) router.push(destination);
      setChosenTeam(null);
      setChosenPlayer(null);
      setRequestMessage("");
      setChosenPlaceholder("");
      return true;
    } catch (caught) {
      setError(message(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const context = data?.context;
  const myTeam = data?.myTeam;
  const preferredCurriculum =
    typeof context?.preferences?.curriculum === "string"
      ? context.preferences.curriculum
      : "any";
  const isOwner = myTeam?.ownerId === user?.id;
  const visibleTeams = useMemo(
    () =>
      (data?.teams ?? []).filter((team) =>
        `${team.name} ${team.school ?? ""} ${team.introduction}`
          .toLowerCase()
          .includes(debouncedSearch),
      ),
    [data?.teams, debouncedSearch],
  );
  const visiblePlayers = useMemo(
    () =>
      (data?.players ?? []).filter((player) =>
        `${player.name} ${player.school ?? ""} ${player.curriculum} ${player.strengths.join(" ")}`
          .toLowerCase()
          .includes(debouncedSearch),
      ),
    [data?.players, debouncedSearch],
  );
  const pending = (data?.requests ?? []).filter(
    (request) => request.status === "pending",
  );
  const ownerApplications = pending.filter(
    (request) =>
      request.kind === "application" && myTeam?.id === request.teamId,
  );
  const myInvitations = pending.filter(
    (request) => request.kind === "invitation" && request.userId === user?.id,
  );

  if (authLoading || roleLoading || loading)
    return (
      <main className="cm-shell cm-state">
        <LoaderCircle className="animate-spin" /> Preparing the competition
        network…
      </main>
    );
  if (!user)
    return (
      <main className="cm-shell cm-state">
        <h1>Competition Team Matching</h1>
        <p>Sign in to build an Academic Profile and find your team.</p>
        <Button onClick={() => openAuth("sign-in")}>Sign in</Button>
      </main>
    );
  if (!data)
    return (
      <main className="cm-shell cm-state">
        <h1>Matching is unavailable</h1>
        <p>{error}</p>
        <Button onClick={() => void refresh()}>Retry</Button>
      </main>
    );

  // The entry route deliberately resumes the last active competition instead of repeating setup.
  const screen = !data.academic
    ? "profile"
    : pathname.includes("/profile")
      ? "profile"
      : !context || pathname.includes("/select")
        ? "select"
        : pathname === "/competition"
          ? "lobby"
          : pathname.includes("/requests")
            ? "requests"
            : pathname.includes("/lounge")
              ? "lounge"
              : pathname.includes("/players")
                ? "players"
                : pathname.includes("/teams")
                  ? "teams"
                  : pathname.startsWith("/competition/team")
                    ? "team"
                    : "lobby";

  function toggle(
    value: string,
    list: string[],
    setter: (values: string[]) => void,
  ) {
    setter(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : list.length < 5
          ? [...list, value]
          : list,
    );
  }
  async function saveAcademic(event: FormEvent) {
    event.preventDefault();
    await act(
      () => saveAcademicProfile(academic),
      "Academic Profile saved.",
      "/competition/select",
    );
  }
  async function saveContext(event: FormEvent) {
    event.preventDefault();
    const saved = await act(
      () =>
        saveMatchingProfile(
          selectedCompetition,
          selectedDivision,
          status,
          target,
          strengths,
          needs,
          {
            curriculum: curriculumPreference,
            economics: economicsPreference,
            experience: experiencePreference,
          },
        ),
      "Your matching lobby is ready.",
      "/competition/lobby",
    );
    if (saved) await refresh(selectedCompetition, selectedDivision);
  }
  async function createTeam(event: FormEvent) {
    event.preventDefault();
    if (!context) return;
    await act(
      () =>
        createCompetitionTeam(
          context.competition,
          context.division,
          teamName,
          teamIntro,
          context.target,
        ),
      "Team created.",
      "/competition/team",
    );
  }

  return (
    <main className="cm-shell">
      <div className="cm-sky" aria-hidden="true" />
      <div className="cm-container">
        <div className="cm-kicker">
          <Sparkles size={14} /> ECONMIND · COMPETITION NETWORK
        </div>
        {(screen === "lobby" ||
          screen === "teams" ||
          screen === "players" ||
          screen === "team" ||
          screen === "requests" ||
          screen === "lounge") &&
          context && (
            <>
              <header className="cm-hero">
                <p>
                  {context.competition} · {context.division}
                </p>
                <h1>
                  Build the team that
                  <br />
                  completes you.
                </h1>
                <span>Discover talent. Find your fit. Form your team.</span>
                <div className="cm-statline">
                  <strong>
                    {data.stats?.players ?? 0} <small>Players</small>
                  </strong>
                  <strong>
                    {data.stats?.teams ?? 0} <small>Teams</small>
                  </strong>
                  <strong>
                    {data.stats?.recruiting ?? 0} <small>Recruiting</small>
                  </strong>
                </div>
              </header>
              <nav className="cm-nav" aria-label="Competition lobby navigation">
                {areaLinks.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className={
                      pathname === href ||
                      (pathname === "/competition" &&
                        href === "/competition/lobby")
                        ? "active"
                        : ""
                    }
                  >
                    {label}
                    {label === "Requests" &&
                      ownerApplications.length + myInvitations.length > 0 && (
                        <i>{ownerApplications.length + myInvitations.length}</i>
                      )}
                  </Link>
                ))}
                <Link href="/competition/select">Switch lobby</Link>
                <Link
                  href="/competition/profile"
                  aria-label="Academic Profile"
                  title="Academic Profile"
                >
                  <span className="cm-profile-avatar">
                    {data.identity?.name?.slice(0, 1) || "P"}
                  </span>
                </Link>
              </nav>
            </>
          )}
        {error && (
          <div role="alert" className="cm-alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="cm-success">
            <Check size={16} />
            {notice}
          </div>
        )}

        {!context && screen !== "profile" && screen !== "select" && (
          <section className="cm-content">
            <h1>Start your matching journey</h1>
            <p className="cm-lead">
              Create an Academic Profile and choose a competition before
              entering the lobby.
            </p>
            <Link
              className="cm-text-link"
              href={
                data.academic ? "/competition/select" : "/competition/profile"
              }
            >
              Continue setup <ArrowRight size={16} />
            </Link>
          </section>
        )}

        {screen === "profile" && (
          <section className="cm-content">
            <div className="cm-eyebrow">01 · YOUR FOUNDATION</div>
            <h1>Academic Profile</h1>
            <p className="cm-lead">
              One reusable profile. Private scores stay private unless you
              choose otherwise.
            </p>
            <div className="cm-identity">
              <ShieldCheck size={22} />
              <div>
                <strong>{data.identity?.name || "Member"}</strong>
                <span>
                  {data.identity?.school || "No school selected"} ·{" "}
                  {data.identity?.grade || "Grade not set"} · Existing EconMind
                  identity
                </span>
              </div>
            </div>
            {!data.identity?.school && (
              <div className="cm-alert">
                <span>
                  Select a school before continuing.{" "}
                  <Link href="/profile">Choose an approved school</Link> or{" "}
                  <Link href="/league/join">request a new school</Link>.
                </span>
                <Button variant="secondary" onClick={() => void refresh()}>
                  Refresh
                </Button>
              </div>
            )}
            <form
              className="cm-form"
              onSubmit={(event) => void saveAcademic(event)}
            >
              <div className="cm-form-grid">
                <Field label="Country / region">
                  <input
                    required
                    maxLength={80}
                    value={academic.country}
                    onChange={(event) =>
                      setAcademic({ ...academic, country: event.target.value })
                    }
                    placeholder="Country or region"
                  />
                </Field>
                <Field label="Location / city">
                  <input
                    required
                    maxLength={120}
                    value={academic.location}
                    onChange={(event) =>
                      setAcademic({ ...academic, location: event.target.value })
                    }
                    placeholder="City, region"
                  />
                </Field>
                <Field label="Curriculum">
                  <select
                    required
                    value={academic.curriculum}
                    onChange={(event) =>
                      setAcademic({
                        ...academic,
                        curriculum: event.target.value,
                        curriculum_detail: {},
                      })
                    }
                  >
                    <option value="">Choose curriculum</option>
                    {["AP", "A-Level", "IB", "Mixed", "Other"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Expected graduation year">
                  <input
                    type="number"
                    min="2024"
                    max="2045"
                    value={academic.graduation_year ?? ""}
                    onChange={(event) =>
                      setAcademic({
                        ...academic,
                        graduation_year: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="GPA (optional)">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={academic.gpa ?? ""}
                    onChange={(event) =>
                      setAcademic({
                        ...academic,
                        gpa: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="GPA scale">
                  <select
                    value={academic.gpa_scale}
                    onChange={(event) =>
                      setAcademic({
                        ...academic,
                        gpa_scale: event.target.value,
                      })
                    }
                  >
                    {["", "4.0", "4.3", "5.0", "100", "Other"].map((value) => (
                      <option key={value} value={value}>
                        {value || "Select scale"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="GPA system">
                  <input
                    maxLength={80}
                    value={academic.gpa_system}
                    onChange={(event) =>
                      setAcademic({
                        ...academic,
                        gpa_system: event.target.value,
                      })
                    }
                    placeholder="Weighted / unweighted / school system"
                  />
                </Field>
              </div>
              {academic.curriculum && (
                <div className="cm-form-section">
                  <h2>{academic.curriculum} Economics</h2>
                  <div className="cm-form-grid">
                    {(academic.curriculum === "Mixed"
                      ? [
                          "AP Microeconomics",
                          "AP Macroeconomics",
                          "Economics stage",
                          "Economics level",
                          "Current grade",
                          "Predicted grade",
                          "Exam board",
                        ]
                      : academic.curriculum === "AP"
                        ? ["AP Microeconomics", "AP Macroeconomics"]
                        : academic.curriculum === "A-Level"
                          ? [
                              "Economics stage",
                              "Current grade",
                              "Predicted grade",
                              "Exam board",
                            ]
                          : academic.curriculum === "IB"
                            ? [
                                "Economics level",
                                "Current grade",
                                "Predicted grade",
                              ]
                            : ["Economics course", "Current level"]
                    ).map((key) => (
                      <Field key={key} label={key}>
                        {(() => {
                          const options = key.startsWith("AP ")
                            ? [
                                "Not Taken",
                                "Currently Taking",
                                "1",
                                "2",
                                "3",
                                "4",
                                "5",
                              ]
                            : key === "Economics stage"
                              ? ["AS", "A2", "Full A-Level"]
                              : key === "Economics level"
                                ? ["HL", "SL"]
                                : key === "Exam board"
                                  ? ["CAIE", "Edexcel", "AQA", "OCR", "Other"]
                                  : [];
                          const value = String(
                            academic.curriculum_detail[key] ?? "",
                          );
                          const onChange = (next: string) =>
                            setAcademic({
                              ...academic,
                              curriculum_detail: {
                                ...academic.curriculum_detail,
                                [key]: next,
                              },
                            });
                          return options.length ? (
                            <select
                              value={value}
                              onChange={(event) => onChange(event.target.value)}
                            >
                              <option value="">Select</option>
                              {options.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={value}
                              onChange={(event) => onChange(event.target.value)}
                            />
                          );
                        })()}
                      </Field>
                    ))}
                  </div>
                </div>
              )}
              <div className="cm-form-section">
                <h2>Academic records</h2>
                <p>
                  Add each attempt separately. These records are not part of
                  your public EconMind identity.
                </p>
                {(
                  [
                    "english_tests",
                    "standardized_tests",
                    "amc_records",
                    "competition_records",
                  ] as const
                ).map((key) => (
                  <AcademicRecordEditor
                    key={key}
                    kind={key}
                    records={academic[key]}
                    rules={data.rules}
                    onChange={(records) =>
                      setAcademic({ ...academic, [key]: records })
                    }
                  />
                ))}
              </div>
              <div className="cm-form-section">
                <h2>Privacy controls</h2>
                <div className="cm-form-grid">
                  {(
                    [
                      "school",
                      "gpa",
                      "economics",
                      "english_tests",
                      "standardized_tests",
                      "amc_records",
                      "competition_records",
                    ] as const
                  ).map((key) => (
                    <Field
                      key={key}
                      label={`${key.replaceAll("_", " ")} visibility`}
                    >
                      <select
                        value={academic.visibility[key] ?? "private"}
                        onChange={(event) =>
                          setAcademic({
                            ...academic,
                            visibility: {
                              ...academic.visibility,
                              [key]: event.target.value as
                                "public" | "matches" | "private",
                            },
                          })
                        }
                      >
                        <option value="private">Private</option>
                        <option value="matches">Matches only</option>
                        <option value="public">Public</option>
                      </select>
                    </Field>
                  ))}
                </div>
              </div>
              <Field label="Short academic introduction">
                <textarea
                  maxLength={600}
                  rows={3}
                  value={academic.bio}
                  onChange={(event) =>
                    setAcademic({ ...academic, bio: event.target.value })
                  }
                />
              </Field>
              <Button
                disabled={
                  busy ||
                  !data.identity?.school ||
                  !academic.country ||
                  !academic.location ||
                  !academic.curriculum
                }
                type="submit"
              >
                {busy ? "Saving…" : "Save and continue"}{" "}
                <ArrowRight size={16} />
              </Button>
            </form>
          </section>
        )}

        {screen === "select" && (
          <section className="cm-content">
            <div className="cm-eyebrow">02 · ENTER YOUR ARENA</div>
            <h1>Choose your competition</h1>
            <p className="cm-lead">
              NEC and IEO profiles stay separate. You can return to either lobby
              at any time.
            </p>
            {!data.academic && (
              <p>
                Complete your{" "}
                <Link href="/competition/profile">Academic Profile</Link> first.
              </p>
            )}
            {data.profiles.length > 0 && (
              <div className="cm-existing">
                {data.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      void (async () => {
                        const opened = await act(
                          () =>
                            openCompetitionContext(
                              profile.competition,
                              profile.division,
                            ),
                          `${profile.competition} · ${profile.division} lobby opened.`,
                          "/competition/lobby",
                        );
                        if (opened)
                          await refresh(profile.competition, profile.division);
                      })();
                    }}
                  >
                    {profile.competition} · {profile.division}
                    <span>{profile.status.replaceAll("_", " ")} →</span>
                  </button>
                ))}
              </div>
            )}
            <div className="cm-competition-cards">
              {["NEC", "IEO"].map((competition) => (
                <button
                  key={competition}
                  type="button"
                  className={
                    selectedCompetition === competition ? "selected" : ""
                  }
                  onClick={() => {
                    setSelectedCompetition(competition);
                    setSelectedDivision(
                      competition === "NEC" ? "AS" : "Senior",
                    );
                  }}
                >
                  <span>COMPETITION</span>
                  <strong>{competition}</strong>
                  <small>
                    {competition === "NEC"
                      ? "PRE · DR · AS"
                      : "Junior · Junior High · Senior"}
                  </small>
                </button>
              ))}
            </div>
            <form
              className="cm-form"
              onSubmit={(event) => void saveContext(event)}
            >
              <div className="cm-form-grid">
                <Field label="Division">
                  <select
                    value={selectedDivision}
                    onChange={(event) =>
                      setSelectedDivision(event.target.value)
                    }
                  >
                    {data.rules
                      .filter(
                        (rule) => rule.competition === selectedCompetition,
                      )
                      .map((rule) => (
                        <option key={rule.division}>{rule.division}</option>
                      ))}
                  </select>
                </Field>
                <Field label="I am">
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="looking_for_team">Looking for a team</option>
                    <option value="looking_for_teammates">
                      Looking for teammates
                    </option>
                  </select>
                </Field>
                <Field label="Competition target">
                  <input
                    maxLength={120}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="Your goal"
                  />
                </Field>
                <Field label="Preferred teammate curriculum">
                  <select
                    value={curriculumPreference}
                    onChange={(event) =>
                      setCurriculumPreference(event.target.value)
                    }
                  >
                    {["any", "AP", "A-Level", "IB", "Other"].map((value) => (
                      <option key={value} value={value}>
                        {value === "any" ? "Any curriculum" : value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Preferred economics background">
                  <select
                    value={economicsPreference}
                    onChange={(event) =>
                      setEconomicsPreference(event.target.value)
                    }
                  >
                    {["any", "introductory", "intermediate", "advanced"].map(
                      (value) => (
                        <option key={value} value={value}>
                          {value === "any" ? "Any background" : value}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Competition experience">
                  <select
                    value={experiencePreference}
                    onChange={(event) =>
                      setExperiencePreference(event.target.value)
                    }
                  >
                    {["any", "newcomer", "experienced"].map((value) => (
                      <option key={value} value={value}>
                        {value === "any" ? "Any experience" : value}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <h2>What can you contribute?</h2>
              <div className="cm-picks">
                {strengthOptions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={strengths.includes(value) ? "chosen" : ""}
                    onClick={() => toggle(value, strengths, setStrengths)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <h2>What are you looking for?</h2>
              <div className="cm-picks">
                {strengthOptions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={needs.includes(value) ? "chosen" : ""}
                    onClick={() => toggle(value, needs, setNeeds)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <Button disabled={busy || !data.academic} type="submit">
                Enter matching lobby <ArrowRight size={16} />
              </Button>
            </form>
          </section>
        )}

        {screen === "lobby" && context && (
          <>
            <div className="cm-heading">
              <div>
                <div className="cm-eyebrow">YOUR STATUS</div>
                <h2>
                  {myTeam
                    ? `${myTeam.name} · ${myTeam.members.length}/${myTeam.capacity}`
                    : context.status === "looking_for_teammates"
                      ? "Recruit your team"
                      : "Looking for a team"}
                </h2>
              </div>
              <span>{pending.length} active requests</span>
            </div>
            <div className="cm-lobby-grid">
              <section className="cm-panel cm-feature">
                <div className="cm-eyebrow">FOR YOU</div>
                <h2>
                  {myTeam
                    ? "Players recommended for your team"
                    : "Teams recommended for you"}
                </h2>
                <p>
                  Fit reflects complementary strengths and your stated needs—not
                  GPA or test-score ranking.
                </p>
                {(myTeam
                  ? [...visiblePlayers]
                      .sort(
                        (a, b) =>
                          fit(
                            myTeam.needs.flatMap((need) => need.tags),
                            b.strengths,
                            preferredCurriculum,
                            b.curriculum,
                          ).score -
                          fit(
                            myTeam.needs.flatMap((need) => need.tags),
                            a.strengths,
                            preferredCurriculum,
                            a.curriculum,
                          ).score,
                      )
                      .slice(0, 3)
                  : [...visibleTeams]
                      .filter((team) => team.recruiting)
                      .sort(
                        (a, b) =>
                          fit(context.strengths, b.needs.flat()).score -
                          fit(context.strengths, a.needs.flat()).score,
                      )
                      .slice(0, 3)
                ).map((item) =>
                  "ownerId" in item ? (
                    <TeamCard
                      key={item.id}
                      team={item}
                      match={fit(context.strengths, item.needs.flat())}
                      onOpen={() => setChosenTeam(item)}
                    />
                  ) : (
                    <PlayerCard
                      key={item.id}
                      player={item}
                      match={fit(
                        myTeam?.needs.flatMap((need) => need.tags) ??
                          context.needs,
                        item.strengths,
                        preferredCurriculum,
                        item.curriculum,
                      )}
                      onOpen={() => setChosenPlayer(item)}
                    />
                  ),
                )}
                {(myTeam ? visiblePlayers : visibleTeams).length === 0 && (
                  <p className="cm-empty">
                    No recommendations yet. Complete your profile or explore the
                    network.
                  </p>
                )}
                <Link
                  href={
                    myTeam
                      ? "/competition/lobby/players"
                      : "/competition/lobby/teams"
                  }
                  className="cm-text-link"
                >
                  Explore all matches <ArrowRight size={16} />
                </Link>
              </section>
              <aside className="cm-panel">
                <div className="cm-eyebrow">LIVE NETWORK</div>
                <h2>
                  {data.stats?.players ?? 0} players · {data.stats?.teams ?? 0}{" "}
                  teams
                </h2>
                <div className="cm-network">
                  {visiblePlayers.slice(0, 5).map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setChosenPlayer(player)}
                    >
                      {player.name.slice(0, 1).toUpperCase()}
                      <span>{player.name}</span>
                    </button>
                  ))}
                </div>
                <Link
                  href="/competition/lobby/players"
                  className="cm-text-link"
                >
                  Scout the network <ChevronRight size={16} />
                </Link>
                {!myTeam && context.status === "looking_for_teammates" && (
                  <form
                    className="cm-mini-form"
                    onSubmit={(event) => void createTeam(event)}
                  >
                    <h3>Create a team</h3>
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Team name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    />
                    <textarea
                      maxLength={600}
                      placeholder="Short introduction"
                      value={teamIntro}
                      onChange={(event) => setTeamIntro(event.target.value)}
                    />
                    <Button disabled={busy} type="submit">
                      Create team
                    </Button>
                  </form>
                )}
              </aside>
            </div>
          </>
        )}

        {(screen === "teams" || screen === "players") && context && (
          <section className="cm-content">
            <div className="cm-eyebrow">
              DISCOVER · {context.competition} {context.division}
            </div>
            <h1>{screen === "teams" ? "Find a team" : "Player scouting"}</h1>
            <div className="cm-search">
              <Search size={18} />
              <input
                aria-label={
                  screen === "teams" ? "Search teams" : "Search players"
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, school or strengths"
              />
            </div>
            <div className="cm-card-grid">
              {screen === "teams"
                ? visibleTeams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      match={fit(context.strengths, team.needs.flat())}
                      onOpen={() => setChosenTeam(team)}
                    />
                  ))
                : visiblePlayers.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      match={fit(
                        context.needs,
                        player.strengths,
                        preferredCurriculum,
                        player.curriculum,
                      )}
                      onOpen={() => setChosenPlayer(player)}
                    />
                  ))}
            </div>
            {(screen === "teams" ? visibleTeams : visiblePlayers).length ===
              0 && (
              <p className="cm-empty">
                No matches in this page. Try a different search or return later.
              </p>
            )}
            <div className="cm-pagination">
              <Button
                variant="secondary"
                disabled={offset === 0}
                onClick={() => {
                  const next = Math.max(0, offset - 20);
                  setOffset(next);
                  void refresh(
                    context.competition,
                    context.division,
                    next,
                    debouncedSearch,
                  );
                }}
              >
                Previous
              </Button>
              <span>Page {Math.floor(offset / 20) + 1}</span>
              <Button
                variant="secondary"
                disabled={
                  (screen === "teams"
                    ? data.teams.length
                    : data.players.length) < 20
                }
                onClick={() => {
                  const next = offset + 20;
                  setOffset(next);
                  void refresh(
                    context.competition,
                    context.division,
                    next,
                    debouncedSearch,
                  );
                }}
              >
                Next
              </Button>
            </div>
          </section>
        )}

        {screen === "requests" && context && (
          <section className="cm-content">
            <div className="cm-eyebrow">APPLICATIONS · INVITATIONS</div>
            <h1>Requests</h1>
            {data.notifications.length > 0 && (
              <div className="cm-notification-strip">
                <span>
                  {data.notifications.length} new updates:{" "}
                  {data.notifications
                    .map((item) => item.kind.replaceAll("_", " "))
                    .slice(0, 3)
                    .join(" · ")}
                </span>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      markCompetitionNotificationsRead,
                      "Updates marked as read.",
                    )
                  }
                >
                  Mark read
                </Button>
              </div>
            )}
            {data.requests.length === 0 && (
              <p className="cm-empty">No requests yet.</p>
            )}
            {data.requests.map((request) => (
              <article className="cm-request" key={request.id}>
                <div>
                  <small>
                    {request.kind.toUpperCase()} · {request.status}
                  </small>
                  <h3>
                    {request.kind === "application"
                      ? request.userName
                      : request.teamName}
                  </h3>
                  <p>{request.message || "No message"}</p>
                  <span>
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {request.status === "pending" &&
                  ((request.kind === "application" &&
                    isOwner &&
                    myTeam?.id === request.teamId) ||
                    (request.kind === "invitation" &&
                      request.userId === user.id)) && (
                    <div className="cm-actions">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              resolveCompetitionRequest(request.id, "accepted"),
                            "Request accepted.",
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              resolveCompetitionRequest(request.id, "declined"),
                            "Request declined.",
                          )
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                {request.status === "pending" &&
                  request.initiatedBy === user.id && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => withdrawCompetitionRequest(request.id),
                          "Request withdrawn.",
                        )
                      }
                    >
                      Withdraw
                    </Button>
                  )}
              </article>
            ))}
          </section>
        )}

        {screen === "lounge" && context && (
          <section className="cm-content">
            <div className="cm-eyebrow">
              {context.competition} · {context.division} LOUNGE
            </div>
            <h1>Recruitment & conversation</h1>
            <p className="cm-lead">
              Meet people in this division. Keep recruitment structured and
              focused.
            </p>
            <div className="cm-lounge-grid">
              <div className="cm-lounge-panel">
                <h2>Recruitment feed</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void (async () => {
                      const saved = await act(
                        () =>
                          postCompetitionRecruitment(
                            context.competition,
                            context.division,
                            recruitmentNote,
                            isOwner ? myTeam?.id : undefined,
                          ),
                        "Recruitment post published.",
                      );
                      if (saved) {
                        setRecruitmentNote("");
                        setLounge(
                          await getCompetitionLounge(
                            context.competition,
                            context.division,
                          ),
                        );
                      }
                    })();
                  }}
                >
                  <label className="cm-field">
                    <span>
                      {isOwner
                        ? `Posting for ${myTeam?.name}`
                        : "Posting as an individual"}
                    </span>
                    <textarea
                      required
                      maxLength={500}
                      value={recruitmentNote}
                      onChange={(event) =>
                        setRecruitmentNote(event.target.value)
                      }
                      placeholder="Short introduction or what you are looking for"
                    />
                  </label>
                  <Button disabled={busy || !recruitmentNote.trim()}>
                    Publish
                  </Button>
                </form>
                {!lounge && (
                  <p className="cm-empty">Loading recruitment activity…</p>
                )}
                {lounge?.posts.length === 0 && (
                  <p className="cm-empty">
                    No recruitment posts in this division yet.
                  </p>
                )}
                {lounge?.posts.map((post) => (
                  <article className="cm-request" key={post.id}>
                    <div>
                      <small>
                        {post.teamId
                          ? "TEAM RECRUITING"
                          : "PLAYER LOOKING FOR TEAM"}
                      </small>
                      <h3>{post.teamName || post.name}</h3>
                      <p>{post.note}</p>
                      <Tags
                        values={post.teamId ? post.needs : post.strengths}
                      />
                      <span>
                        {post.school || "Cross-school network"} ·{" "}
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        router.push(
                          post.teamId
                            ? "/competition/lobby/teams"
                            : "/competition/lobby/players",
                        )
                      }
                    >
                      Explore
                    </Button>
                  </article>
                ))}
              </div>
              <div className="cm-lounge-panel">
                <h2>Lobby chat</h2>
                <p>
                  Only members of {context.competition} · {context.division} can
                  participate.
                </p>
                <div className="cm-chat-scroll">
                  {!lounge && <p>Loading conversation…</p>}
                  {lounge?.messages.length === 0 && (
                    <p>Start the conversation.</p>
                  )}
                  {lounge?.messages.map((item) => (
                    <div className="cm-chat-line" key={item.id}>
                      <strong>{item.name}</strong>
                      <span>{item.body}</span>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void (async () => {
                      const sent = await act(
                        () =>
                          postCompetitionLobbyMessage(
                            context.competition,
                            context.division,
                            lobbyMessage,
                          ),
                        "Message sent.",
                      );
                      if (sent) {
                        setLobbyMessage("");
                        setLounge(
                          await getCompetitionLounge(
                            context.competition,
                            context.division,
                          ),
                        );
                      }
                    })();
                  }}
                >
                  <input
                    required
                    maxLength={500}
                    value={lobbyMessage}
                    onChange={(event) => setLobbyMessage(event.target.value)}
                    placeholder="Message this division"
                  />
                  <Button disabled={busy || !lobbyMessage.trim()}>Send</Button>
                </form>
              </div>
            </div>
          </section>
        )}

        {screen === "team" && context && (
          <section className="cm-content">
            <div className="cm-eyebrow">TEAM ROOM · WAR ROOM</div>
            <h1>{myTeam?.name ?? "My Team"}</h1>
            {!myTeam ? (
              <div className="cm-empty">
                You haven&apos;t joined a team yet.{" "}
                <Link href="/competition/lobby/teams">
                  Find Teams <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <>
                <p className="cm-lead">{myTeam.introduction}</p>
                <div className="cm-statline">
                  <strong>
                    {myTeam.members.length + myTeam.placeholders.length}{" "}
                    <small>of {myTeam.capacity} seats</small>
                  </strong>
                  <strong>
                    {myTeam.capacity -
                      myTeam.members.length -
                      myTeam.placeholders.length}{" "}
                    <small>open slots</small>
                  </strong>
                </div>
                <h2>Team members</h2>
                <div className="cm-card-grid">
                  {myTeam.members.map((member) => (
                    <div className="cm-member" key={member.id}>
                      <span>{member.name.slice(0, 1)}</span>
                      <strong>{member.name}</strong>
                      <small>{member.school || "EconMind member"}</small>
                      {member.role === "owner" ? (
                        <Crown size={16} />
                      ) : isOwner ? (
                        <div className="cm-member-actions">
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Transfer team ownership to ${member.name}?`,
                                )
                              )
                                void act(
                                  () =>
                                    transferCompetitionTeam(
                                      myTeam.id,
                                      member.id,
                                    ),
                                  "Team ownership transferred.",
                                );
                            }}
                          >
                            Make captain
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${member.name} from this team?`,
                                )
                              )
                                void act(
                                  () =>
                                    leaveCompetitionTeam(myTeam.id, member.id),
                                  "Member removed.",
                                );
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {myTeam.placeholders.map((person) => (
                    <div className="cm-member" key={person.id}>
                      <span>◇</span>
                      <strong>{person.name}</strong>
                      <small>
                        {person.school || "Existing member · not registered"}
                      </small>
                      {isOwner && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove reserved seat for ${person.name}?`,
                              )
                            )
                              void act(
                                () => removeCompetitionPlaceholder(person.id),
                                "Reserved seat removed.",
                              );
                          }}
                        >
                          Remove placeholder
                        </button>
                      )}
                    </div>
                  ))}
                  {Array.from(
                    {
                      length: Math.max(
                        0,
                        myTeam.capacity -
                          myTeam.members.length -
                          myTeam.placeholders.length,
                      ),
                    },
                    (_, index) => (
                      <div className="cm-member cm-empty-slot" key={index}>
                        <span>+</span>
                        <strong>Open slot</strong>
                        <small>Define who completes this team</small>
                      </div>
                    ),
                  )}
                </div>
                {isOwner && (
                  <div className="cm-team-tools">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void act(
                          () =>
                            addCompetitionPlaceholder(
                              myTeam.id,
                              placeholderName,
                              placeholderSchool,
                            ),
                          "Existing member added.",
                        );
                        setPlaceholderName("");
                        setPlaceholderSchool("");
                      }}
                    >
                      <h3>Add existing member</h3>
                      <input
                        required
                        placeholder="Name"
                        value={placeholderName}
                        onChange={(event) =>
                          setPlaceholderName(event.target.value)
                        }
                      />
                      <input
                        placeholder="School (optional)"
                        value={placeholderSchool}
                        onChange={(event) =>
                          setPlaceholderSchool(event.target.value)
                        }
                      />
                      <Button disabled={busy} type="submit">
                        Add placeholder
                      </Button>
                    </form>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void act(
                          () =>
                            addCompetitionNeed(
                              myTeam.id,
                              context.needs,
                              needNote,
                            ),
                          "Recruitment need published.",
                        );
                        setNeedNote("");
                      }}
                    >
                      <h3>Define recruitment need</h3>
                      <Tags values={context.needs} />
                      <input
                        maxLength={300}
                        placeholder="What does this empty slot need?"
                        value={needNote}
                        onChange={(event) => setNeedNote(event.target.value)}
                      />
                      <Button disabled={busy} type="submit">
                        Save need
                      </Button>
                    </form>
                    <div>
                      <h3>Recruitment</h3>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              setCompetitionRecruiting(
                                myTeam.id,
                                !myTeam.recruiting,
                              ),
                            myTeam.recruiting
                              ? "Recruitment closed."
                              : "Recruitment reopened.",
                          )
                        }
                      >
                        {myTeam.recruiting
                          ? "Close recruitment"
                          : "Open recruitment"}
                      </Button>
                    </div>
                  </div>
                )}
                <h2>Team DNA</h2>
                <div className="cm-dna">
                  <Tags
                    values={[
                      ...new Set([
                        ...myTeam.needs.flatMap((need) => need.tags),
                        ...context.strengths,
                      ]),
                    ]}
                  />
                </div>
                <h2>Team chat</h2>
                <div className="cm-chat">
                  {myTeam.messages.map((item) => (
                    <p key={item.id}>
                      <strong>{item.name}</strong> {item.body}
                    </p>
                  ))}
                  {myTeam.messages.length === 0 && <p>No messages yet.</p>}
                </div>
                <form
                  className="cm-chat-compose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act(
                      () => postCompetitionMessage(myTeam.id, messageDraft),
                      "Message sent.",
                    );
                    setMessageDraft("");
                  }}
                >
                  <input
                    required
                    maxLength={1200}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Message your team"
                  />
                  <Button disabled={busy} type="submit">
                    Send
                  </Button>
                </form>
                {!isOwner && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Leave this team?"))
                        void act(
                          () => leaveCompetitionTeam(myTeam.id),
                          "You left the team.",
                        );
                    }}
                  >
                    Leave team
                  </Button>
                )}
              </>
            )}
          </section>
        )}

        {(chosenTeam || chosenPlayer) && (
          <div
            className="cm-drawer-backdrop"
            onClick={() => {
              setChosenTeam(null);
              setChosenPlayer(null);
            }}
          >
            <aside
              className="cm-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={chosenTeam ? "Team details" : "Player details"}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="cm-close"
                aria-label="Close details"
                onClick={() => {
                  setChosenTeam(null);
                  setChosenPlayer(null);
                }}
              >
                <X />
              </button>
              {chosenTeam && (
                <>
                  <div className="cm-eyebrow">
                    TEAM · {context?.competition} {context?.division}
                  </div>
                  <h2>{chosenTeam.name}</h2>
                  <p>{chosenTeam.introduction}</p>
                  <p>
                    {chosenTeam.school || "Cross-school team"} ·{" "}
                    {chosenTeam.members + chosenTeam.placeholders}/
                    {chosenTeam.capacity} seats
                  </p>
                  <h3>Why this match</h3>
                  <ul>
                    {fit(
                      context?.strengths ?? [],
                      chosenTeam.needs.flat(),
                    ).reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <Tags values={chosenTeam.needs.flat()} />
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void act(
                        () =>
                          applyToCompetitionTeam(chosenTeam.id, requestMessage),
                        "Application sent.",
                      );
                    }}
                  >
                    <Field label="Optional message">
                      <textarea
                        maxLength={300}
                        value={requestMessage}
                        onChange={(event) =>
                          setRequestMessage(event.target.value)
                        }
                      />
                    </Field>
                    <Button
                      disabled={
                        busy ||
                        !chosenTeam.recruiting ||
                        chosenTeam.members + chosenTeam.placeholders >=
                          chosenTeam.capacity ||
                        Boolean(myTeam)
                      }
                      type="submit"
                    >
                      {chosenTeam.members + chosenTeam.placeholders >=
                      chosenTeam.capacity
                        ? "Team full"
                        : "Apply to team"}
                    </Button>
                  </form>
                  <button
                    className="cm-danger"
                    onClick={() => {
                      const reason = window.prompt(
                        "Why are you reporting this team?",
                      );
                      if (reason)
                        void act(
                          () =>
                            reportCompetitionContent(
                              null,
                              chosenTeam.id,
                              reason,
                            ),
                          "Report submitted.",
                        );
                    }}
                  >
                    Report team
                  </button>
                </>
              )}
              {chosenPlayer && (
                <>
                  <div className="cm-eyebrow">
                    PLAYER · {context?.competition} {context?.division}
                  </div>
                  <h2>{chosenPlayer.name}</h2>
                  <p>
                    {chosenPlayer.school || "EconMind member"} ·{" "}
                    {chosenPlayer.curriculum}
                  </p>
                  <p>{chosenPlayer.bio}</p>
                  <Tags values={chosenPlayer.strengths} />
                  <h3>Why this match</h3>
                  <ul>
                    {fit(
                      context?.needs ?? [],
                      chosenPlayer.strengths,
                      preferredCurriculum,
                      chosenPlayer.curriculum,
                    ).reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  {chosenPlayer.academicDetails?.gpa != null && (
                    <p>
                      GPA: {chosenPlayer.academicDetails.gpa} /{" "}
                      {chosenPlayer.academicDetails.gpaScale}
                    </p>
                  )}
                  {Object.keys(chosenPlayer.academicDetails?.economics ?? {})
                    .length > 0 && (
                    <p>
                      Economics:{" "}
                      {Object.entries(chosenPlayer.academicDetails.economics)
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(" · ")}
                    </p>
                  )}
                  {chosenPlayer.academicDetails?.competitionRecords?.length >
                    0 && (
                    <div>
                      <h3>Competition history</h3>
                      {chosenPlayer.academicDetails.competitionRecords.map(
                        (record, index) => (
                          <p key={index}>{JSON.stringify(record)}</p>
                        ),
                      )}
                    </div>
                  )}
                  {chosenPlayer.academicDetails?.amcRecords?.length > 0 && (
                    <p>
                      AMC:{" "}
                      {chosenPlayer.academicDetails.amcRecords
                        .map((record) => JSON.stringify(record))
                        .join(" · ")}
                    </p>
                  )}
                  {chosenPlayer.academicDetails?.englishTests?.length > 0 && (
                    <p>
                      English:{" "}
                      {chosenPlayer.academicDetails.englishTests
                        .map((record) => JSON.stringify(record))
                        .join(" · ")}
                    </p>
                  )}
                  {chosenPlayer.academicDetails?.standardizedTests?.length >
                    0 && (
                    <p>
                      SAT / ACT:{" "}
                      {chosenPlayer.academicDetails.standardizedTests
                        .map((record) => JSON.stringify(record))
                        .join(" · ")}
                    </p>
                  )}
                  {isOwner && myTeam && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void act(
                          () =>
                            inviteCompetitionPlayer(
                              myTeam.id,
                              chosenPlayer.id,
                              requestMessage,
                              chosenPlaceholder || undefined,
                            ),
                          "Invitation sent.",
                        );
                      }}
                    >
                      <Field label="Invitation message">
                        <textarea
                          maxLength={300}
                          value={requestMessage}
                          onChange={(event) =>
                            setRequestMessage(event.target.value)
                          }
                        />
                      </Field>
                      {myTeam.placeholders.length > 0 && (
                        <Field label="Bind an existing member (optional)">
                          <select
                            value={chosenPlaceholder}
                            onChange={(event) =>
                              setChosenPlaceholder(event.target.value)
                            }
                          >
                            <option value="">New team seat</option>
                            {myTeam.placeholders.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Button
                        disabled={
                          busy ||
                          (myTeam.members.length + myTeam.placeholders.length >=
                            myTeam.capacity &&
                            !chosenPlaceholder)
                        }
                        type="submit"
                      >
                        Invite player
                      </Button>
                    </form>
                  )}
                  <button
                    className="cm-danger"
                    onClick={() => {
                      const reason = window.prompt(
                        "Why are you reporting this player?",
                      );
                      if (reason)
                        void act(
                          () =>
                            reportCompetitionContent(
                              chosenPlayer.id,
                              null,
                              reason,
                            ),
                          "Report submitted.",
                        );
                    }}
                  >
                    Report player
                  </button>
                  <button
                    className="cm-danger"
                    onClick={() => {
                      if (window.confirm(`Block ${chosenPlayer.name}?`))
                        void act(
                          () => blockCompetitionUser(chosenPlayer.id),
                          "Player blocked.",
                        );
                    }}
                  >
                    Block player
                  </button>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function TeamCard({
  team,
  match,
  onOpen,
}: {
  team: Team;
  match: ReturnType<typeof fit>;
  onOpen: () => void;
}) {
  return (
    <button className="cm-result-card" onClick={onOpen}>
      <span className="cm-eyebrow">
        TEAM · {team.recruiting ? "RECRUITING" : "CLOSED"}
      </span>
      <h3>{team.name}</h3>
      <p>{team.introduction || "Building a team for the competition."}</p>
      <Tags values={team.needs.flat()} />
      <footer>
        <span>
          {team.members + team.placeholders}/{team.capacity} seats ·{" "}
          {team.school || "Cross-school"}
        </span>
        <strong>
          {match.score}% fit <ArrowRight size={15} />
        </strong>
      </footer>
    </button>
  );
}
function PlayerCard({
  player,
  match,
  onOpen,
}: {
  player: Player;
  match: ReturnType<typeof fit>;
  onOpen: () => void;
}) {
  return (
    <button className="cm-result-card" onClick={onOpen}>
      <span className="cm-eyebrow">PLAYER · LOOKING FOR TEAM</span>
      <h3>{player.name}</h3>
      <p>
        {player.school || "EconMind member"} ·{" "}
        {player.curriculum || "Curriculum pending"}
      </p>
      <Tags values={player.strengths} />
      <footer>
        <span>{player.target || "Open to opportunities"}</span>
        <strong>
          {match.score}% fit <ArrowRight size={15} />
        </strong>
      </footer>
    </button>
  );
}
