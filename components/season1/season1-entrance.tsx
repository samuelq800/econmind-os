"use client";

import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { withBasePath } from "@/lib/base-path";
import { getSeason1Opening, type Season1Opening } from "@/lib/supabase/season1";
import { Season1TeamLobby } from "./season1-team-lobby";
import styles from "./season1-entrance.module.css";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Season 1 access could not be checked.";
}

export function Season1Entrance() {
  const { user, loading: authLoading, roleLoading, openAuth } = useAuth();
  const [gate, setGate] = useState<Season1Opening | null>(null);
  const [entered, setEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const openingTimer = useRef<number | null>(null);

  const applyGate = useCallback((next: Season1Opening) => {
    setGate(next);
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
    return () => {
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

  useEffect(() => {
    if (entered && !window.location.hash) window.scrollTo(0, 0);
  }, [entered]);

  const ready = gate?.isOpen === true;

  async function openDoor() {
    if (!ready || opening || checking) return;
    setChecking(true);
    setError("");
    try {
      const latest = await getSeason1Opening();
      applyGate(latest);
      if (!latest.isOpen) {
        setError("Team Lobby is not open yet. Please try again shortly.");
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
      }, reduceMotion ? 80 : 1100);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setChecking(false);
    }
  }

  if (authLoading || roleLoading) return <div className={styles.message}>Checking Season 1 access…</div>;
  if (!user) return <div className={styles.message}><p>Sign in to enter Season 1.</p><button type="button" onClick={() => openAuth("sign-in")}>Sign in</button></div>;
  if (entered && ready) return <Season1TeamLobby />;

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
        <h1>{opening ? "The world is opening." : "Enter the world."}</h1>
        <p className={styles.subtitle}>Build teams. Shape strategies. Simulate real change.</p>
      </div>

      <div className={styles.bottom}>
        <div className={styles.status}><span className={ready ? styles.readyDot : styles.lockedDot} /> Team Lobby <strong>{ready ? "OPEN" : gate ? "NOT OPEN" : "CHECKING"}</strong></div>
        <button type="button" className={styles.openButton} disabled={!ready || opening || checking} onClick={() => void openDoor()}>
          {ready ? <Sparkles size={20} /> : <LockKeyhole size={18} />}
          {opening ? "Opening the gate…" : checking ? "Checking access…" : "Open Lobby"}
          {ready && !opening && <ArrowRight size={19} />}
        </button>
        <p>{ready ? "Click to open the gateway to Team Lobby." : gate ? "Team Lobby is not open yet." : "Checking Team Lobby access…"}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </div>
  </main>;
}
