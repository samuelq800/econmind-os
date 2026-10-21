import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error Media renderer is a dependency-free JavaScript build script.
import { DURATION, FPS, ROTATION, FILTER } from "../scripts/render-home-sky-v2.mjs";

const component = readFileSync("components/home/home-cinematic-sky.tsx", "utf8");
const home = readFileSync("components/home/editorial-home.tsx", "utf8");
const css = readFileSync("app/visual-pilot-city.css", "utf8");

describe("cinematic homepage sky", () => {
  it("keeps the existing badge and destinations, moving only the desktop copy", () => {
    expect(home).toContain("<HomeCinematicSky />");
    expect(home).toContain('className="home-hero-copy relative z-10 max-w-4xl"');
    expect(css).toContain("padding-top:clamp(32px,3.3vw,64px)");
    expect(home).toContain('href="/tiao-run"');
    expect(home).toContain('href="/explore"');
    expect(home).toContain('href="/league"');
    expect(home).toContain('sizes="(min-width: 1024px) 38vw, 72vw"');
  });
  it("makes one full constant-speed turn with continuous position and velocity", () => {
    expect(DURATION).toBe(120);
    expect(FPS).toBe(30);
    expect(ROTATION).toBe("2*PI*t/120");
    const angle = (t: number) => 2 * Math.PI * t / DURATION;
    const position = (t: number) => [Math.cos(angle(t)), Math.sin(angle(t))];
    expect(position(0)[0]).toBeCloseTo(position(DURATION)[0], 12);
    expect(position(0)[1]).toBeCloseTo(position(DURATION)[1], 12);
    const step = 1 / FPS;
    const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(distance(position(DURATION - step), position(0))).toBeCloseTo(distance(position(0), position(step)), 12);
    // The architecture overlays AFTER rotation and is never transformed.
    expect(FILTER.indexOf("rotate=")).toBeLessThan(FILTER.indexOf("[sky][frame]overlay"));
    expect(FILTER).not.toMatch(/xfade|fade=|reverse/);
  });
  it("uses muted inline responsive playback, a still fallback, and no accessibility focus targets", () => {
    expect(component).toContain('aria-hidden="true"');
    expect(component).toContain("muted loop playsInline");
    expect(component).toContain('preload="none"');
    expect(component).toContain("tabIndex={-1}");
    expect(component).toContain("observatory-loop-720.mp4");
    expect(component).toContain("observatory-loop-1080.mp4");
    expect(component).toContain("observatory-poster.jpg");
    expect(component).toContain("withBasePath");
    expect(css).toContain("pointer-events:none;background-size:cover");
  });
  it("does not force motion on hidden, offscreen, reduced-motion or data-saving clients", () => {
    expect(component).toContain("!document.hidden && !preference.matches && !connection?.saveData && intersecting");
    expect(component).toContain("observer?.disconnect()");
    expect(component).toContain('removeEventListener("visibilitychange", update)');
    expect(component).toContain("desiredPlayback.current = false; element.pause()");
    expect(css).toContain(".home-cinematic-sky video {display:none;transition:none;}");
    expect(css).toContain("5%,100% {opacity:0;");
  });
  it("retains the image-generation source layers for future editing", () => {
    expect(existsSync("design/home-sky-v2/starfield-source.png")).toBe(true);
    expect(existsSync("design/home-sky-v2/observatory-frame-source.png")).toBe(true);
  });
});
