import Link from "next/link";
import {
  ArrowDown,
  Crown,
  Globe2,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import { Season1WorldArtwork } from "./season1-world-artwork";

/** Same scene, typography and motion layers as the Lobby and My Team. */
export function Season1CountryHero() {
  return (
    <section className="season1-world-hero relative isolate overflow-hidden rounded-2xl border border-[#2b6f68] px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-14">
      <Season1WorldArtwork />
      <div className="relative z-10 flex min-h-[34rem] flex-col justify-center gap-10 lg:min-h-[37rem]">
        <div className="season1-world-copy">
          <p className="season1-eyebrow">
            <span className="season1-live-pip" /> Season 1 / Your next chapter
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold tracking-[-.075em] sm:text-6xl lg:text-7xl">
            Find your country.
            <br />
            <em>Shape your future.</em>
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
            Explore one connected world and 70 country scenes. Choose a starting
            point together, then let your captain submit your team’s preference.
          </p>
          <div className="season1-hero-actions mt-8 flex flex-wrap gap-3">
            <a
              href="#country-preference"
              className="s1-country-hero-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition"
            >
              <Globe2 size={17} /> Choose a country <ArrowDown size={17} />
            </a>
            <Link
              href="/season1/my-team"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/18"
            >
              <Crown size={17} /> Manage My Team
            </Link>
          </div>
          <div
            className="season1-world-proof"
            aria-label="Country selection requirements"
          >
            <span>
              <UsersRound size={16} /> 3+ members
            </span>
            <span>
              <LockKeyhole size={16} /> Recruitment locked
            </span>
            <span>
              <Crown size={16} /> Captain submits
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
