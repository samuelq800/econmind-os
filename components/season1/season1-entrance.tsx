"use client";

import { ArrowRight, Clock3, LockKeyhole, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { withBasePath } from "@/lib/base-path";
import { getSeason1Opening, setSeason1Opening, type Season1Opening } from "@/lib/supabase/season1";
import { Season1TeamLobby } from "./season1-team-lobby";
import styles from "./season1-entrance.module.css";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function shanghaiInput(iso: string) {
  return new Date(Date.parse(iso) + SHANGHAI_OFFSET_MS).toISOString().slice(0, 16);
}

function openingLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function countdownUnits(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return [
    { label: "Days", value: Math.floor(seconds / 86_400) },
    { label: "Hours", value: Math.floor((seconds % 86_400) / 3_600) },
    { label: "Minutes", value: Math.floor((seconds % 3_600) / 60) },
    { label: "Seconds", value: seconds % 60 },
  ];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Season 1 opening time could not be loaded.";
}

export function Season1Entrance() {
  const { user, loading: authLoading, roleLoading, worldSupervisor, openAuth } = useAuth();
  const [gate, setGate] = useState<Season1Opening | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const openingTimer = useRef<number | null>(null);

  const applyGate = useCallback((next: Season1Opening) => {
    setGate(next);
    setServerOffset(Date.parse(next.serverNow) - Date.now());
    setDraft((current) => current || shanghaiInput(next.opensAt));
    if (!next.isOpen) {
      setEntered(false);
      setOpening(false);
    }
  }, []);

  const refreshGate = useCallback(async () => {
    try {
      applyGate(await getSeason1Opening());
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [applyGate]);

  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    const initial = window.setTimeout(() => void refreshGate(), 0);
    const interval = window.setInterval(() => void refreshGate(), 10_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshGate(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authLoading, roleLoading, user, refreshGate]);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!entered || !window.location.hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [entered]);

  const target = gate ? Date.parse(gate.opensAt) : Number.POSITIVE_INFINITY;
  const remaining = gate ? target - ((now ?? Date.parse(gate.serverNow) - serverOffset) + serverOffset) : 0;
  const ready = gate !== null && now !== null && remaining <= 0;

  async function openDoor() {
    if (!ready || opening || checking) return;
    setChecking(true);
    setError("");
    try {
      const latest = await getSeason1Opening();
      applyGate(latest);
      if (!latest.isOpen) {
        setError("The opening time has changed. Please wait for the updated countdown.");
        return;
      }
      setOpening(true);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      openingTimer.current = window.setTimeout(async () => {
        try {
          const confirmed = await getSeason1Opening();
          applyGate(confirmed);
          if (confirmed.isOpen) setEntered(true);
        } catch (caught) {
          setError(errorMessage(caught));
        } finally {
          setOpening(false);
        }
      }, reduceMotion ? 100 : 2200);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setChecking(false);
    }
  }

  async function saveOpening(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const parsed = new Date(`${draft}+08:00`);
      if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid GMT+8 date and time.");
      const next = await setSeason1Opening(parsed.toISOString());
      applyGate(next);
      setDraft(shanghaiInput(next.opensAt));
      setSettingsOpen(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || roleLoading) return <div className={styles.message}>Checking Season 1 access…</div>;
  if (!user) return <div className={styles.message}><p>Sign in to enter Season 1.</p><button type="button" onClick={() => openAuth("sign-in")}>Sign in</button></div>;
  if (entered && ready && gate) return <><Season1TeamLobby />{worldSupervisor && <button type="button" className={styles.returnSettings} onClick={() => { setDraft(shanghaiInput(gate.opensAt)); setEntered(false); setSettingsOpen(true); }}><Settings2 size={16} /> Opening settings</button>}</>;

  return <main className={`${styles.scene} ${opening ? styles.opening : ""}`} style={{ backgroundImage: `url("${withBasePath("/images/season1/season1-gateway-wide.jpg")}")` }}>
    <div className={styles.vignette} aria-hidden="true" />
    <div className={styles.portalGlow} aria-hidden="true" />
    <div className={styles.doorFrame} aria-hidden="true">
      <div className={`${styles.door} ${styles.doorLeft}`} />
      <div className={`${styles.door} ${styles.doorRight}`} />
      <div className={styles.seam} />
    </div>
    <div className={styles.lightTrail} aria-hidden="true" />
    <div className={styles.particles} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>

    <div className={styles.content}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>EconMind World <span>·</span> Season 1</p>
        <h1>{opening ? "The world is opening." : "The world opens soon."}</h1>
        <p className={styles.subtitle}>Build teams. Shape strategies. Simulate real change.</p>
      </div>

      <section className={styles.countdown} aria-label="Countdown to Season 1 Team Lobby opening">
        <div className={styles.countdownHeading}>
          <span><Clock3 size={15} /> World access opens {ready ? "now" : "in"}</span>
          <time dateTime={gate?.opensAt}>{gate ? `${openingLabel(gate.opensAt)} GMT+8` : "Loading opening time…"}</time>
        </div>
        <div className={styles.units}>
          {countdownUnits(remaining).map((unit) => <div key={unit.label} className={styles.unit}><strong>{String(unit.value).padStart(2, "0")}</strong><span>{unit.label}</span></div>)}
        </div>
      </section>

      <div className={styles.bottom}>
        <div className={styles.status}><span className={ready ? styles.readyDot : styles.lockedDot} /> Team Lobby <strong>{ready ? "READY" : "LOCKED"}</strong></div>
        <button type="button" className={styles.openButton} disabled={!ready || opening || checking} onClick={() => void openDoor()}>
          {ready ? <Sparkles size={20} /> : <LockKeyhole size={18} />}
          {opening ? "Opening the gate…" : checking ? "Checking access…" : "Open Season 1"}
          {ready && !opening && <ArrowRight size={19} />}
        </button>
        <p>{ready ? "Click to open the gateway to Team Lobby." : "The gateway unlocks when the countdown reaches zero."}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {worldSupervisor && <div className={styles.adminArea}>
          <button type="button" className={styles.settingsButton} onClick={() => { if (gate) setDraft(shanghaiInput(gate.opensAt)); setSettingsOpen((current) => !current); }}><Settings2 size={15} /> Adjust opening time</button>
          {settingsOpen && <form className={styles.settingsPanel} onSubmit={(event) => void saveOpening(event)}>
            <label htmlFor="season1-opening-time">Opening time · GMT+8</label>
            <input id="season1-opening-time" type="datetime-local" required value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button type="submit" disabled={saving || !gate}>{saving ? "Saving…" : "Save opening time"}</button>
          </form>}
        </div>}
      </div>
    </div>
  </main>;
}
