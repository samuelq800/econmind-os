"use client";

import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";

const ASSET_ROOT = "/images/visual-pilot/home-sky-v2";

/** Decorative only. The still remains usable if autoplay is blocked or motion is disabled. */
export function HomeCinematicSky() {
  const container = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const desiredPlayback = useRef(false);
  const [loadVideo, setLoadVideo] = useState(false);
  const [ready, setReady] = useState(false);
  const [playbackAllowed, setPlaybackAllowed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const bounds = container.current?.getBoundingClientRect();
    let intersecting = !bounds || (bounds.bottom > 0 && bounds.top < window.innerHeight);
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const allowed = !document.hidden && !preference.matches && !connection?.saveData && intersecting;
      setPlaybackAllowed(allowed);
      if (allowed) setLoadVideo(true);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    if (container.current) observer?.observe(container.current);
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    queueMicrotask(update);
    return () => {
      disposed = true;
      observer?.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    desiredPlayback.current = playbackAllowed;
    if (!playbackAllowed) {
      element.pause();
      return;
    }
    // Reconcile any late play completion after an observer/preference cleanup.
    element.muted = true;
    void element.play().then(() => { if (!desiredPlayback.current) element.pause(); }).catch(() => {
      // Keep the poster visible. Do not force autoplay or show a decorative-media error.
    });
    return () => { desiredPlayback.current = false; element.pause(); };
  }, [loadVideo, playbackAllowed]);

  return <figure ref={container} className="home-cinematic-sky" aria-hidden="true" data-ready={ready && playbackAllowed}
    style={{ backgroundImage: `url("${withBasePath(`${ASSET_ROOT}/observatory-poster.jpg`)}")` }}>
    {loadVideo && <video ref={video} muted loop playsInline preload="none" tabIndex={-1} disablePictureInPicture
      poster={withBasePath(`${ASSET_ROOT}/observatory-poster.jpg`)} onPlaying={() => setReady(true)}>
      <source media="(max-width: 767px)" src={withBasePath(`${ASSET_ROOT}/observatory-loop-720.mp4`)} type="video/mp4" />
      <source src={withBasePath(`${ASSET_ROOT}/observatory-loop-1080.mp4`)} type="video/mp4" />
    </video>}
  </figure>;
}
