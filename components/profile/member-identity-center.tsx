"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Globe2,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfilePrivacyControls } from "@/components/governance/profile-privacy-controls";
import {
  memberDate,
  preferenceLabels,
  safeImageUrl,
  type MemberIdentity,
  type MemberProfile,
  type PreferenceCategory,
} from "@/lib/profile/member-identity";
import {
  changeMyMemberSchool,
  getMyMemberIdentity,
  saveMyMemberIdentity,
  saveMyMemberPreferences,
} from "@/lib/supabase/member-identity";
import {
  listApprovedSchoolChoices,
  type ApprovedSchoolChoice,
} from "@/lib/supabase/account-onboarding";

const field =
  "mt-2 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2.5 text-sm font-normal";
const muted = "text-sm leading-6 text-[var(--ink-muted)]";
const chip =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium";
type Setter = Dispatch<SetStateAction<MemberProfile | null>>;
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Could not save. Please try again.";
}
function Notice({ error, message }: { error: string; message: string }) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-[var(--accent)]">
          {message}
        </p>
      )}
    </>
  );
}
function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
      {eyebrow && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
          {eyebrow}
        </p>
      )}
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
function ProductLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
    >
      {children}
      <ArrowUpRight size={14} />
    </Link>
  );
}
function Avatar({
  url,
  name,
  small = false,
}: {
  url: string | null;
  name: string;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const source = safeImageUrl(url);
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)] ${small ? "h-12 w-12 text-lg" : "h-24 w-24 text-3xl"}`}
    >
      {source && !failed ? (
        <Image
          src={source}
          alt=""
          fill
          unoptimized
          referrerPolicy="no-referrer"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "EM"
      )}
    </div>
  );
}

export function MemberIdentityCenter({
  profile,
  setProfile,
  email,
}: {
  profile: MemberProfile;
  setProfile: Setter;
  email?: string;
}) {
  const [editing, setEditing] = useState(false);
  const name = profile.identity.displayName || "EconMind member";
  const date = memberDate(profile.identity.memberSince);
  const primary = preferenceLabels(profile, "area").find(
    (choice) => choice.primary,
  );
  const activities = preferenceLabels(profile, "activity");
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[var(--accent)]">
            EconMind OS · Member identity
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Your place in EconMind.
          </h1>
        </div>
        <span className="text-xs text-[var(--ink-muted)]">
          Identity / Interests / Participation
        </span>
      </div>
      <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />
        <div className="flex flex-wrap items-start gap-5">
          <Avatar
            key={profile.identity.avatarUrl}
            url={profile.identity.avatarUrl}
            name={name}
          />
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
              {name}
            </h2>
            <p className={`mt-2 ${muted}`}>
              {[
                profile.school?.name || "No school selected",
                profile.identity.grade,
                profile.identity.graduationYear &&
                  `Class of ${profile.identity.graduationYear}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {profile.identity.bio && (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6">
                {profile.identity.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <span
                  key={role.label}
                  className={`${chip} border-transparent bg-[var(--accent-soft)] text-[var(--accent)]`}
                >
                  <ShieldCheck size={13} />
                  {role.label}
                </span>
              ))}
              {primary && (
                <span className={chip}>Interest · {primary.label}</span>
              )}
              {activities.slice(0, 3).map((choice) => (
                <span key={choice.key} className={chip}>
                  Interested · {choice.label}
                </span>
              ))}
            </div>
            {date && (
              <p className="mt-4 text-xs text-[var(--ink-muted)]">
                Member since {date}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
            aria-controls="identity-editor"
          >
            {editing ? "Close editor" : "Edit profile"}
          </Button>
        </div>
        {editing && (
          <IdentityForm
            key={profile.userId}
            identity={profile.identity}
            setProfile={setProfile}
          />
        )}
      </section>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <PreferenceSection
            profile={profile}
            setProfile={setProfile}
            category="area"
            title="Areas of Interest"
            description="Choose one primary direction and any additional interests. These are personal preferences, not department roles."
          />
          <PreferenceSection
            profile={profile}
            setProfile={setProfile}
            category="economics"
            title="Economics Interests"
            description="The questions and ideas you want to explore."
          />
          <PreferenceSection
            profile={profile}
            setProfile={setProfile}
            category="activity"
            title="Activities You’re Interested In"
            description="Choose what you would like to explore. Interest does not register you or join a team."
          />
          {activities.some((choice) => choice.key === "season1") && (
            <Section
              title="Season 1 preferences"
              eyebrow="Preferred ≠ assigned"
            >
              <p className={muted}>
                Team and office preferences are managed in the existing Season 1
                team space. They do not assign an office.
              </p>
              {!!profile.activity.season1?.rolePreferences?.length && (
                <p className="mt-3 text-sm">
                  Saved preferences:{" "}
                  {profile.activity.season1.rolePreferences.join(" · ")}
                </p>
              )}
              <ProductLink href="/season1/my-team">
                Open My Team preferences
              </ProductLink>
            </Section>
          )}
          {activities.some((choice) => choice.key === "research") && (
            <PreferenceSection
              profile={profile}
              setProfile={setProfile}
              category="research"
              title="Research Preferences"
              description="Choose how you would like to contribute. Academic topics use your Economics Interests above."
            />
          )}
          <Participation profile={profile} />
        </div>
        <aside className="grid min-w-0 gap-6">
          <SchoolSection profile={profile} setProfile={setProfile} />
          <Section title="EconMind Roles" eyebrow="System records · Read only">
            {profile.roles.length ? (
              <ul className="space-y-4">
                {profile.roles.map((role) => (
                  <li key={role.label}>
                    <p className="flex items-center gap-2 font-semibold text-[var(--accent)]">
                      <ShieldCheck size={16} />
                      {role.label}
                    </p>
                    {role.context && (
                      <p className={`mt-1 ${muted}`}>{role.context}</p>
                    )}
                    <ProductLink href={role.href}>
                      Open{" "}
                      {role.href.startsWith("/league") ? "League" : "Learn"}
                    </ProductLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={muted}>No official EconMind roles assigned.</p>
            )}
            <p className="mt-4 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--ink-muted)]">
              Interests and skills never grant roles or permissions. Official
              responsibilities are managed through the relevant EconMind system.
            </p>
          </Section>
          <PreferenceSection
            profile={profile}
            setProfile={setProfile}
            category="skill"
            title="Skills"
            description="Your self-declared strengths and tools."
          />
          <PreferenceSection
            profile={profile}
            setProfile={setProfile}
            category="collaboration"
            title="Open to Collaborate"
            description="Availability preferences only. Selecting an option does not enroll you in a team or project."
          />
        </aside>
      </div>
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Profile privacy</h2>
        <p className={`mt-2 ${muted}`}>
          Your new bio, grade, interests, skills and collaboration preferences
          are visible only to you. Existing display-name and school visibility
          in League is unchanged. No public profile is created here.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">
            Account, privacy and support
          </summary>
          <ProfilePrivacyControls email={email} />
        </details>
      </section>
    </main>
  );
}

function IdentityForm({
  identity,
  setProfile,
}: {
  identity: MemberIdentity;
  setProfile: Setter;
}) {
  const [draft, setDraft] = useState(identity);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (draft.avatarUrl?.trim() && !safeImageUrl(draft.avatarUrl.trim())) {
      setError("Use a valid HTTPS image URL without credentials.");
      return;
    }
    setBusy(true);
    try {
      await saveMyMemberIdentity(draft);
      setProfile(
        (current) =>
          current && {
            ...current,
            identity: {
              ...draft,
              displayName: draft.displayName?.trim() || null,
              avatarUrl: draft.avatarUrl?.trim() || null,
              bio: draft.bio.trim(),
              grade: draft.grade.trim(),
            },
          },
      );
      setMessage("Profile saved.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      id="identity-editor"
      onSubmit={(event) => void save(event)}
      className="mt-6 border-t border-[var(--line)] pt-6"
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Display name
          <input
            className={field}
            maxLength={80}
            value={draft.displayName || ""}
            onChange={(event) =>
              setDraft({ ...draft, displayName: event.target.value })
            }
          />
        </label>
        <label className="text-xs font-semibold">
          Avatar image URL (HTTPS)
          <input
            type="url"
            className={field}
            maxLength={2048}
            placeholder="https://…"
            value={draft.avatarUrl || ""}
            onChange={(event) =>
              setDraft({ ...draft, avatarUrl: event.target.value })
            }
          />
        </label>
        <label className="text-xs font-semibold sm:col-span-2">
          Short bio
          <textarea
            className={field}
            rows={3}
            maxLength={600}
            value={draft.bio}
            onChange={(event) =>
              setDraft({ ...draft, bio: event.target.value })
            }
          />
        </label>
        <label className="text-xs font-semibold">
          Grade
          <input
            className={field}
            maxLength={40}
            value={draft.grade}
            onChange={(event) =>
              setDraft({ ...draft, grade: event.target.value })
            }
            placeholder="e.g. Grade 11"
          />
        </label>
        <label className="text-xs font-semibold">
          Graduation year
          <input
            className={field}
            type="number"
            min={2024}
            max={2045}
            value={draft.graduationYear ?? ""}
            onChange={(event) =>
              setDraft({
                ...draft,
                graduationYear: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </label>
        <label className="text-xs font-semibold">
          Economics club name
          <input
            className={field}
            maxLength={160}
            value={draft.clubName || ""}
            onChange={(event) =>
              setDraft({ ...draft, clubName: event.target.value })
            }
          />
        </label>
        <label className="text-xs font-semibold">
          Personal League preference (not a role)
          <select
            className={field}
            value={draft.leaguePreference || ""}
            onChange={(event) =>
              setDraft({
                ...draft,
                leaguePreference: (event.target.value ||
                  null) as MemberIdentity["leaguePreference"],
              })
            }
          >
            <option value="">No preference</option>
            <option value="participant">Participant</option>
            <option value="team_lead">Team lead</option>
            <option value="school_liaison">School liaison</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
          <Notice error={error} message={message} />
        </div>
      </fieldset>
    </form>
  );
}

const activityDetails: Record<string, { text: string; icon: typeof Globe2 }> = {
  season1: {
    text: "Economic strategy and collaborative simulation.",
    icon: Globe2,
  },
  research: {
    text: "Read, write and share economic research.",
    icon: BookOpen,
  },
  "live-rooms": {
    text: "Explore decisions and outcomes together.",
    icon: Radio,
  },
};
function PreferenceSection({
  profile,
  setProfile,
  category,
  title,
  description,
}: {
  profile: MemberProfile;
  setProfile: Setter;
  category: PreferenceCategory;
  title: string;
  description: string;
}) {
  const saved = profile.choices.filter(
    (choice) => choice.category === category,
  );
  const [keys, setKeys] = useState(saved.map((choice) => choice.key));
  const [primary, setPrimary] = useState(
    saved.find((choice) => choice.primary)?.key || "",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const options = profile.options.filter(
    (option) => option.category === category,
  );
  const dirty =
    JSON.stringify([...keys].sort()) !==
      JSON.stringify(saved.map((choice) => choice.key).sort()) ||
    primary !== (saved.find((choice) => choice.primary)?.key || "");
  function toggle(key: string) {
    setMessage("");
    if (keys.includes(key)) {
      setKeys(keys.filter((value) => value !== key));
      if (primary === key) setPrimary("");
    } else {
      setKeys([...keys, key]);
      if (category === "area" && !primary) setPrimary(key);
    }
  }
  async function save() {
    if (busy) return;
    setError("");
    setMessage("");
    if (category === "area" && keys.length && !primary) {
      setError("Choose exactly one primary interest.");
      return;
    }
    setBusy(true);
    try {
      await saveMyMemberPreferences(category, keys, primary || null);
      setProfile(
        (current) =>
          current && {
            ...current,
            choices: [
              ...current.choices.filter(
                (choice) => choice.category !== category,
              ),
              ...keys.map((key) => ({
                category,
                key,
                primary: key === primary,
              })),
            ],
          },
      );
      setMessage("Preferences saved. Roles and participation are unchanged.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title={title} eyebrow="Personal preferences">
      <p className={`mb-4 ${muted}`}>{description}</p>
      <fieldset disabled={busy} aria-label={title}>
        <div
          className={
            category === "activity"
              ? "grid gap-3 sm:grid-cols-3"
              : "flex flex-wrap gap-2"
          }
        >
          {options.map((option) => {
            const selected = keys.includes(option.key),
              product =
                category === "activity" ? activityDetails[option.key] : null;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(option.key)}
                className={`${product ? "flex min-w-0 flex-col items-start gap-3 rounded-xl p-4 text-left text-sm" : "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs"} border transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--canvas)] hover:border-[var(--accent)]"}`}
              >
                {product && <product.icon size={23} />}
                <span className="font-semibold">{option.label}</span>
                {product && (
                  <span className="text-xs leading-5 text-[var(--ink-muted)]">
                    {product.text}
                  </span>
                )}
                {product ? (
                  <span className="mt-auto inline-flex items-center gap-1 text-xs">
                    {selected && <Check size={13} />}
                    {selected ? "Interested" : "Select interest"}
                  </span>
                ) : (
                  selected && <Check size={12} />
                )}
              </button>
            );
          })}
        </div>
        {category === "area" && keys.length > 0 && (
          <label className="mt-4 block text-xs font-semibold">
            Primary interest
            <select
              className={field}
              value={primary}
              onChange={(event) => {
                setPrimary(event.target.value);
                setMessage("");
              }}
            >
              <option value="">Choose one primary interest</option>
              {options
                .filter((option) => keys.includes(option.key))
                .map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        {!keys.length && (
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            No preferences selected yet.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save preferences"}
          </Button>
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setKeys(saved.map((choice) => choice.key));
                setPrimary(saved.find((choice) => choice.primary)?.key || "");
                setError("");
                setMessage("");
              }}
            >
              Cancel
            </Button>
          )}
        </div>
        <Notice error={error} message={message} />
      </fieldset>
    </Section>
  );
}

function SchoolSection({
  profile,
  setProfile,
}: {
  profile: MemberProfile;
  setProfile: Setter;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [leaving, setLeaving] = useState(false),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [schools, setSchools] = useState<ApprovedSchoolChoice[]>([]);
  const [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const school = profile.school;
  async function open(leave: boolean) {
    setLeaving(leave);
    setSelected("");
    setSearch("");
    setError("");
    setMessage("");
    dialog.current?.showModal();
    if (!leave) {
      setLoading(true);
      try {
        setSchools(await listApprovedSchoolChoices());
      } catch (caught) {
        setError(errorText(caught));
      } finally {
        setLoading(false);
      }
    }
  }
  async function save() {
    if (busy || (!leaving && !selected)) return;
    setBusy(true);
    setError("");
    try {
      await changeMyMemberSchool(leaving ? null : selected, school?.id || null);
      const next = await getMyMemberIdentity();
      if (next.userId !== profile.userId)
        throw new Error("Your account changed. Reload to continue.");
      setProfile(next);
      setMessage(
        leaving
          ? "School affiliation removed. Your history is unchanged."
          : "School affiliation updated. Your history is unchanged.",
      );
      dialog.current?.close();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="School" eyebrow="League affiliation">
      {school ? (
        <>
          <div className="flex items-start gap-3">
            <Avatar
              key={school.logoUrl}
              url={school.logoUrl}
              name={school.name}
              small
            />
            <div className="min-w-0">
              <h3 className="break-words font-semibold">{school.name}</h3>
              <p className={muted}>
                {[school.city, school.area].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            Current affiliation · School directory status: {school.status}
          </p>
          <ProductLink
            href={`/league/schools/profile?school=${encodeURIComponent(school.name)}`}
          >
            View School
          </ProductLink>
        </>
      ) : (
        <p className={muted}>
          No school selected. Join your school’s EconMind community.
        </p>
      )}
      {profile.schoolChangeGuard ? (
        <div className="mt-4 rounded-lg bg-[var(--accent-soft)] p-4">
          <p className="text-xs leading-5">
            {profile.schoolChangeGuard === "leader"
              ? "You currently hold School Leader responsibility. Please step down or transfer the role through League before leaving or changing school."
              : "You belong to an active League school team. Please resolve that membership through League before leaving or changing school."}
          </p>
          <ProductLink href="/league/dashboard">Open League</ProductLink>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void open(false)}
          >
            {school ? "Change School" : "Choose School"}
          </Button>
          {school && (
            <Button size="sm" variant="ghost" onClick={() => void open(true)}>
              Leave School
            </Button>
          )}
        </div>
      )}
      <Notice error="" message={message} />
      <dialog
        ref={dialog}
        aria-labelledby="school-dialog-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)] shadow-xl backdrop:bg-black/60"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="school-dialog-title" className="text-xl font-semibold">
            {leaving ? "Leave your school?" : "Change school affiliation"}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => dialog.current?.close()}
            aria-label="Close school dialog"
            className="rounded p-1"
          >
            <X size={20} />
          </button>
        </div>
        <p className={`mt-3 ${muted}`}>
          Current school: {school?.name || "No school selected"}
        </p>
        {!leaving && (
          <>
            {loading ? (
              <p role="status" className="mt-4">
                Loading approved schools…
              </p>
            ) : (
              <>
                <label className="mt-4 block text-xs font-semibold">
                  Search schools
                  <input
                    className={field}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="mt-4 block text-xs font-semibold">
                  New school
                  <select
                    className={field}
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose an approved school</option>
                    {schools
                      .filter(
                        (item) =>
                          item.id !== school?.id &&
                          (item.id === selected ||
                            `${item.name} ${item.city}`
                              .toLowerCase()
                              .includes(search.toLowerCase())),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.city ? ` · ${item.city}` : ""}
                        </option>
                      ))}
                  </select>
                </label>
                {selected && (
                  <p className="mt-4 rounded-lg bg-[var(--accent-soft)] p-3 text-sm">
                    Changing to:{" "}
                    <strong>
                      {schools.find((item) => item.id === selected)?.name}
                    </strong>
                  </p>
                )}
              </>
            )}
          </>
        )}
        <p className={`mt-4 ${muted}`}>
          Your account and previous activity history will remain intact.{" "}
          {leaving
            ? "You will no longer be listed as a current member of this school."
            : "This updates your current school in League; it does not assign any leadership role."}
        </p>
        <Notice error={error} message="" />
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
          <Button
            variant={leaving ? "danger" : "primary"}
            disabled={busy || loading || (!leaving && !selected)}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : leaving ? "Confirm leave" : "Confirm change"}
          </Button>
        </div>
      </dialog>
    </Section>
  );
}

function Participation({ profile }: { profile: MemberProfile }) {
  const { season1, research, liveRoomsHosted } = profile.activity;
  return (
    <Section
      title="Your EconMind Activity"
      eyebrow="Actual participation · Read only"
    >
      <p className={`mb-5 ${muted}`}>
        Connected to your account’s real records. Selecting an interest above
        does not change these records.
      </p>
      <div className="divide-y divide-[var(--line)]">
        <div className="pb-5">
          <h3 className="font-semibold">Season 1</h3>
          {season1 ? (
            <>
              <p className="mt-2 text-lg font-semibold">{season1.teamName}</p>
              <p className={muted}>
                Team status: {season1.teamStatus} ·{" "}
                {season1.memberRole === "captain" ? "Captain" : "Team member"}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                Team membership is not proof of completed registration.
                Registration follows the team’s current status. Economy and
                office assignments are not exposed by the current lobby service.
              </p>
              <ProductLink href="/season1/my-team">Open My Team</ProductLink>
            </>
          ) : (
            <>
              <p className={`mt-2 ${muted}`}>
                No Season 1 team participation yet.
              </p>
              <ProductLink href="/season1">Explore Season 1</ProductLink>
            </>
          )}
        </div>
        <div className="py-5">
          <h3 className="font-semibold">Research Library</h3>
          {research && research.submissions > 0 ? (
            <div className="mt-3 flex flex-wrap gap-8">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {research.submissions}
                </p>
                <p className={muted}>Papers in your library</p>
              </div>
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {research.publications}
                </p>
                <p className={muted}>Published</p>
              </div>
            </div>
          ) : (
            <p className={`mt-2 ${muted}`}>
              {research
                ? "No research contributions yet."
                : "Research activity is not available yet."}
            </p>
          )}
          <ProductLink href="/learn/research/my">Open My Research</ProductLink>
        </div>
        <div className="pt-5">
          <h3 className="font-semibold">Live Rooms</h3>
          <p className={`mt-2 ${muted}`}>
            {liveRoomsHosted
              ? `${liveRoomsHosted} room${liveRoomsHosted === 1 ? "" : "s"} created by this account.`
              : liveRoomsHosted === null
                ? "Room activity is not available yet."
                : "No hosted rooms recorded for this account."}
          </p>
          <ProductLink href="/live-world">Explore Live Rooms</ProductLink>
        </div>
      </div>
    </Section>
  );
}
