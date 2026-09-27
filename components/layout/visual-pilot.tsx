"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { withBasePath } from "@/lib/base-path";
import { visualScene } from "@/lib/visual-scene";

/** Decorative presentation only. Authentication and data providers are unchanged. */
export function VisualPilot({ children }: { children: ReactNode }) {
  const path = (usePathname() || "/").replace(/\/$/, "") || "/";
  const variant = visualScene(path);
  const city = ["/about", "/explore", "/collaboration", "/league", "/league/about", "/models", "/simulation"].includes(path);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    queueMicrotask(visibility);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  return <div className="visual-pilot" data-scene={variant} data-motion={hidden ? "off" : "on"}
    style={{
      "--pilot-scene-image": `url("${withBasePath(city ? "/images/visual-pilot/finance-city-night.jpg" : "/images/visual-pilot/observatory-atmosphere.jpg")}")`,
      "--pilot-scene-light": `url("${withBasePath(city ? "/images/visual-pilot/finance-city-dawn.jpg" : "/images/visual-pilot/observatory-atmosphere.jpg")}")`,
    } as CSSProperties}>
    <div className="pilot-backdrop" aria-hidden="true">
      <div className="pilot-grid" />
      <div className="pilot-glow pilot-glow-a" />
      <div className="pilot-glow pilot-glow-b" />
      <div className="pilot-orbit" />
      <div className="pilot-stars">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${2 + ((i * 29) % 96)}%`, top: `${5 + ((i * 23) % 88)}%`, animationDelay: `${-i * 1.7}s` }} />)}</div>
    </div>
    <div className="pilot-content">{children}</div>
  </div>;
}
