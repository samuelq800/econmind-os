"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Globe2,
  LockKeyhole,
  UsersRound,
  X,
  Check,
} from "lucide-react";
import { useRoomRefresh } from "@/lib/live-room/use-room-refresh";
import { withBasePath } from "@/lib/base-path";
import {
  countryByCode,
  normalizeCountryCode,
  season1Countries,
  WORLD_URL,
  type CountryPreferenceView,
} from "@/lib/season1/countries";
import {
  getCountryPreferences,
  saveCountryPreference,
  subscribeCountryPreferences,
  unsubscribeCountryPreferences,
} from "@/lib/supabase/season1-countries";
import "./season1-country-preferences.css";

export function Season1CountryPreferences({ userId }: { userId: string }) {
  const [view, setView] = useState<CountryPreferenceView | null>(null);
  const seasonIdentity = useRef<string | null>(null);
  const [error, setError] = useState("");
  const refresh = useRoomRefresh(`season-1:countries:${userId}`, {
    fetch: getCountryPreferences,
    onView: (value) => {
      seasonIdentity.current = value.seasonId;
      setView(value);
      setError("");
    },
    onError: () =>
      setError("Country preferences could not be loaded. Please retry."),
    terminal: () => false,
    subscribe: (_id, change, status, disposed) => {
      if (!seasonIdentity.current)
        throw new Error("Season identity is unavailable");
      return subscribeCountryPreferences(
        seasonIdentity.current,
        change,
        status,
        disposed,
      );
    },
    unsubscribe: unsubscribeCountryPreferences,
  });
  return (
    <CountryPreferencePanel
      view={view}
      error={error}
      retry={refresh}
      save={async (teamId, code, expected) => {
        try {
          const saved = await saveCountryPreference(teamId, code, expected);
          setView((previous) =>
            previous &&
            Date.parse(previous.serverNow) > Date.parse(saved.serverNow)
              ? previous
              : saved,
          );
        } catch (error) {
          void refresh();
          throw error;
        }
        await refresh();
      }}
    />
  );
}

export function CountryPreferencePanel({
  view,
  save,
  error = "",
  retry,
}: {
  view: CountryPreferenceView | null;
  save: (
    teamId: string,
    code: string,
    expected: string | null,
  ) => Promise<void>;
  error?: string;
  retry?: () => Promise<unknown>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState("52");
  const [base, setBase] = useState<{
    teamId: string;
    code: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const team = view?.myTeam;
  const current = countryByCode(team?.preference?.code);
  const selected = countryByCode(chosen);
  const availability = new Map(
    view?.countries.map((country) => [country.code, country]) ?? [],
  );
  const selectedAvailability = availability.get(chosen);
  const taken = Boolean(
    selectedAvailability?.reserved && !selectedAvailability.selectedByMyTeam,
  );
  const canSave = Boolean(
    team?.eligible &&
    base?.teamId === team.id &&
    selected &&
    selectedAvailability &&
    !taken &&
    !busy,
  );
  const filtered = season1Countries.filter((country) =>
    `${country.code} ${country.name}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const close = () => {
    dialog.current?.close();
    openButton.current?.focus();
  };
  const open = () => {
    setBase(
      team ? { teamId: team.id, code: team.preference?.code ?? null } : null,
    );
    setChosen(team?.preference?.code ?? "52");
    setQuery("");
    setSaveError("");
    setSuccess("");
    dialog.current?.showModal();
  };
  const submit = async () => {
    if (!canSave || !base) return;
    setBusy(true);
    setSaveError("");
    setSuccess("");
    try {
      await save(base.teamId, chosen, base.code);
      setSuccess(`Country ${chosen} · ${selected?.name} saved for your team.`);
      close();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The selection could not be saved. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      id="country-preference"
      className="s1-country-panel"
      aria-labelledby="s1-country-heading"
    >
      <div className="s1-country-intro">
        <div>
          <p className="s1-country-eyebrow">SEASON 1 / COUNTRY PREFERENCE</p>
          <h2 id="s1-country-heading">Choose where your story begins.</h2>
          <p>
            Explore 70 countries. A captain may reserve one preference for a
            locked team of at least 3 members.
          </p>
        </div>
        <a
          className="s1-world-link"
          href={WORLD_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Globe2 size={26} />
          <span>
            <strong>Explore EconMind World</strong>
            <small>world.econmind.group</small>
          </span>
          <ExternalLink size={18} />
        </a>
      </div>
      <div className="s1-country-summary">
        <div className="s1-country-selected">
          {/* Images are already optimized at import; preserve native scene framing. */}
          <Image
            unoptimized
            src={withBasePath((current ?? season1Countries[51]).thumbnail)}
            alt={
              current
                ? `${current.name} country scene`
                : "Zorin illustrated country scene"
            }
            width={160}
            height={160}
          />
          <div>
            <small>
              {current ? "YOUR TEAM’S PREFERENCE" : "COUNTRY EXPLORER"}
            </small>
            <h3>
              {current
                ? `${current.code} · ${current.name}`
                : "One team. One starting point."}
            </h3>
            <p>
              {!view
                ? "Loading your current team…"
                : team
                  ? team.name
                  : "Join or create a team to submit a preference."}
            </p>
            {team?.preference && (
              <small>
                Saved {new Date(team.preference.selectedAt).toLocaleString()}
              </small>
            )}
          </div>
        </div>
        <div className="s1-country-action">
          <div className="s1-country-checks">
            <span>
              <UsersRound size={16} />
              {team
                ? `${team.memberCount} members / 3 minimum`
                : "3 members minimum"}
            </span>
            <span>
              <LockKeyhole size={16} />
              {team?.recruitmentLocked
                ? "Recruitment locked"
                : "Recruitment must be locked"}
            </span>
            <span>
              {team?.isCaptain
                ? "Captain access"
                : "Only the captain can submit"}
            </span>
          </div>
          <button
            ref={openButton}
            className="s1-country-primary"
            onClick={open}
            disabled={!view}
          >
            {current ? "View / change country" : "Explore countries"}{" "}
            <Globe2 size={18} />
          </button>
        </div>
      </div>
      <p className="s1-country-note">
        Preference only — not an official World allocation. Unlocking
        recruitment or falling below 3 members automatically releases the
        country. Captains can still remove members.
      </p>
      {success && (
        <p role="status" className="s1-country-success">
          <Check size={16} />
          {success}
        </p>
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void retry?.()}>Retry</button>
        </p>
      )}
      <dialog
        ref={dialog}
        className="s1-country-dialog"
        aria-labelledby="s1-country-dialog-heading"
        onCancel={() => openButton.current?.focus()}
      >
        <header>
          <div>
            <p className="s1-country-eyebrow">70 COUNTRIES / ONE PREFERENCE</p>
            <h2 id="s1-country-dialog-heading">Choose your country</h2>
          </div>
          <button
            type="button"
            aria-label="Close country selection"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className="s1-country-dialog-body">
          <aside className="s1-country-detail">
            {selected && (
              <>
                <Image
                  unoptimized
                  src={withBasePath(selected.image)}
                  alt={`${selected.code} ${selected.name} — full illustrated scene`}
                  width={selected.width}
                  height={selected.height}
                />
                <div className="s1-country-detail-heading">
                  <h3>
                    {selected.code} · {selected.name}
                  </h3>
                  <a
                    href={withBasePath(selected.image)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View HD <ExternalLink size={14} />
                  </a>
                </div>
              </>
            )}
            <label>
              <span>
                Country code <span aria-hidden="true">*</span>
              </span>
              <input
                required
                aria-label="Country code"
                placeholder="01–70"
                inputMode="numeric"
                maxLength={2}
                value={chosen}
                onChange={(event) => {
                  setChosen(
                    normalizeCountryCode(event.target.value) ??
                      event.target.value,
                  );
                  setSaveError("");
                }}
              />
            </label>
            <p aria-live="polite">
              {!selected
                ? "Enter a country code from 01 to 70."
                : taken
                  ? "Reserved by another team — choose another country."
                  : selectedAvailability?.selectedByMyTeam
                    ? "Currently reserved by your team."
                    : "Available for your team’s preference."}
            </p>
            {!team?.eligible && (
              <p className="s1-country-warning">
                {!team
                  ? "Join a team first."
                  : !team.isCaptain
                    ? "Ask your team captain to submit."
                    : !team.recruitmentLocked
                      ? "Lock recruitment in My Team before submitting."
                      : team.memberCount < 3
                        ? "Your team needs at least 3 members."
                        : "This team cannot change preferences in its current status."}
              </p>
            )}
            {saveError && (
              <p role="alert" className="s1-country-warning">
                {saveError}
              </p>
            )}
            <button
              className="s1-country-primary"
              disabled={!canSave}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : "Confirm country preference"}
            </button>
            <small>
              This reserves an OS registration preference, not a World country
              assignment.
            </small>
          </aside>
          <div className="s1-country-browser">
            <label>
              Find a country
              <input
                type="search"
                placeholder="Search code or country name"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p className="s1-country-grid-caption">
              {filtered.length} countries · Reserved countries cannot be
              selected again
            </p>
            <div className="s1-country-grid">
              {filtered.map((country) => {
                const status = availability.get(country.code);
                const unavailable = Boolean(
                  status?.reserved && !status.selectedByMyTeam,
                );
                return (
                  <button
                    key={country.code}
                    aria-pressed={chosen === country.code}
                    aria-label={`${country.code} ${country.name}${unavailable ? ", reserved" : status?.selectedByMyTeam ? ", your team" : ", available"}`}
                    disabled={!status || unavailable || busy}
                    onClick={() => {
                      setChosen(country.code);
                      setSaveError("");
                    }}
                    className="s1-country-card"
                  >
                    <Image
                      unoptimized
                      src={withBasePath(country.thumbnail)}
                      width={480}
                      height={480}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <strong>
                        <b>{country.code}</b> {country.name}
                      </strong>
                      <small>
                        {unavailable
                          ? "Reserved"
                          : status?.selectedByMyTeam
                            ? "Your team"
                            : "Available"}
                      </small>
                    </span>
                    {chosen === country.code && (
                      <Check className="s1-country-card-check" size={20} />
                    )}
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && <p>No country matches your search.</p>}
          </div>
        </div>
      </dialog>
    </section>
  );
}
