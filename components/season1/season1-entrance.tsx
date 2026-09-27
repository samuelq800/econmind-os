"use client";

import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/auth-provider";
import { withBasePath } from "@/lib/base-path";
import { getSeason1Lobby, getSeason1Opening, type Season1LobbyData, type Season1Opening } from "@/lib/supabase/season1";
import { entranceVisitStorage, hasSeenSeason1Entrance, markSeason1EntranceSeen } from "@/lib/season1/entrance-visit";
import { Season1TeamLobby } from "./season1-team-lobby";
import styles from "./season1-entrance.module.css";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Season 1 access could not be checked.";
}

export function Season1Entrance() {
  const { user } = useAuth();
  return <Season1EntranceScene key={`${user?.id ?? "signed-out"}:${user?.last_sign_in_at ?? "unknown"}`} />;
}

function Season1EntranceScene() {
  const { user, loading: authLoading, roleLoading, openAuth } = useAuth();
  const userId = user?.id;
  const loginAt = user?.last_sign_in_at;
  const [gate, setGate] = useState<Season1Opening | null>(null);
  const [entered, setEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [lobby, setLobby] = useState<Season1LobbyData | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(true);
  const openingTimer = useRef<number | null>(null);
  const attempt = useRef(0);

  const applyGate = useCallback((next: Season1Opening) => {
    setGate(next);
    if (!next.isOpen) {
      attempt.current += 1;
      if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
      setEntered(false);
      setOpening(false);
      setChecking(false);
      setBlurred(false);
      setLobby(null);
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
    if (authLoading || roleLoading || !userId) return;
    const currentUserId = userId;
    let active = true;
    let interval: number | null = null;
    async function initialize() {
      try {
        const next = await getSeason1Opening();
        if (!active) return;
        applyGate(next);
        if (next.isOpen && hasSeenSeason1Entrance({ id: currentUserId, last_sign_in_at: loginAt }, entranceVisitStorage())) {
          const preparedLobby = await getSeason1Lobby();
          if (!active) return;
          const confirmed = await getSeason1Opening();
          if (!active) return;
          applyGate(confirmed);
          if (confirmed.isOpen) {
            setLobby(preparedLobby);
            setEntered(true);
          }
        }
        setError("");
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      } finally {
        if (active) {
          setRestoring(false);
          interval = window.setInterval(() => void refreshGate(), 10_000);
        }
      }
    }
    void initialize();
    const onVisible = () => { if (interval !== null && document.visibilityState === "visible") void refreshGate(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authLoading, roleLoading, userId, loginAt, applyGate, refreshGate]);

  useEffect(() => {
    return () => {
      attempt.current += 1;
      if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!entered) return;
    // Paint the populated lobby under the blur before bringing it into focus.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setBlurred(false), 80);
    const cleanup = window.setTimeout(() => setOpening(false), reduceMotion ? 300 : 1880);
    return () => { window.clearTimeout(timer); window.clearTimeout(cleanup); };
  }, [entered]);

  useEffect(() => {
    if (!opening || entered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [opening, entered]);

  useEffect(() => {
    if ((!checking && !opening) || entered) return;
    // A stalled request must never leave the entrance covered indefinitely.
    const timeout = window.setTimeout(() => {
      attempt.current += 1;
      if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
      setOpening(false);
      setBlurred(false);
      setChecking(false);
      setError("The lobby is taking too long to respond. Please try again.");
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [checking, opening, entered]);

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
    const currentAttempt = ++attempt.current;
    try {
      const latest = await getSeason1Opening();
      if (currentAttempt !== attempt.current) return;
      applyGate(latest);
      if (!latest.isOpen) {
        setError("Team Lobby is not open yet. Please try again shortly.");
        return;
      }
      setOpening(true);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const animation = new Promise<void>((resolve) => {
        openingTimer.current = window.setTimeout(() => {
          setBlurred(true);
          // Let the 1.4s fade reach solid white, then hold it for 400ms.
          openingTimer.current = window.setTimeout(resolve, reduceMotion ? 80 : 1800);
        }, reduceMotion ? 80 : 600);
      });
      // Fetch during the door animation; never mount the lobby's loading card.
      const [preparedLobby] = await Promise.all([getSeason1Lobby(), animation]);
      if (currentAttempt !== attempt.current) return;
      const confirmed = await getSeason1Opening();
      if (currentAttempt !== attempt.current) return;
      applyGate(confirmed);
      if (confirmed.isOpen) {
        if (user) markSeason1EntranceSeen(user, entranceVisitStorage());
        setLobby(preparedLobby);
        setEntered(true);
      }
    } catch (caught) {
      if (currentAttempt !== attempt.current) return;
      if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
      setOpening(false);
      setBlurred(false);
      setError(errorMessage(caught));
    } finally {
      if (currentAttempt === attempt.current) setChecking(false);
    }
  }

  if (authLoading || roleLoading) return <div className={styles.message}>Checking Season 1 access…</div>;
  if (!user) return <div className={styles.message}><p>Sign in to enter Season 1.</p><button type="button" onClick={() => openAuth("sign-in")}>Sign in</button></div>;
  if (restoring) return <div className={styles.message}>Checking Season 1 access…</div>;
  return <>
    {opening && createPortal(<div className={`${styles.transitionVeil} ${blurred ? styles.blurred : ""} ${entered && !blurred ? styles.releasing : ""}`} aria-hidden="true">
      <div className={styles.bloom} />
      <div className={styles.glass} />
    </div>, document.body)}
    <div className={styles.viewport} inert={opening && !entered}>
    {entered && ready && lobby && <Season1TeamLobby initialLobby={lobby} />}
    {(!entered || opening) && <main aria-hidden={entered || undefined} inert={entered} className={`${styles.scene} ${opening ? styles.opening : ""} ${entered ? styles.departing : ""} ${entered && !blurred ? styles.dissolving : ""}`} style={{ backgroundImage: `url("${withBasePath("/images/season1/season1-gateway-wide.jpg")}")` }}>
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
        <h1>Enter the world.</h1>
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
  </main>}
    </div>
  </>;
}
