import type { CSSProperties } from "react";

type LiveWorldThemeProperties = CSSProperties & Record<`--${string}`, string>;

export const LIVE_WORLD_THEME: LiveWorldThemeProperties = {
  "--canvas": "#07120f",
  "--surface": "#10231c",
  "--surface-subtle": "#142a22",
  "--surface-strong": "#1a3329",
  "--ink": "#edf5f1",
  "--ink-muted": "#a7bbb1",
  "--ink-faint": "#789287",
  "--line": "#294238",
  "--line-strong": "#365c4d",
  "--accent": "#0f8061",
  "--accent-strong": "#159872",
  "--accent-soft": "#173b31",
  "--amber": "#f5c965",
  "--amber-soft": "#3b3320",
  "--red": "#ffb8bb",
  "--red-soft": "#542c31",
  "--blue": "#81b2eb",
  "--blue-soft": "#1c3047",
  "--shadow": "0 1px 2px rgba(0, 0, 0, .22), 0 24px 72px rgba(0, 0, 0, .24)",
};
