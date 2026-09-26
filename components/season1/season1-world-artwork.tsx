import Image from "next/image";
import { withBasePath } from "@/lib/base-path";

/** Shared, unmodified visual layers for the Lobby and My Team. */
export function Season1WorldArtwork() {
  return <>
        <div className="season1-world-grid" aria-hidden="true" />
        <div className="season1-world-vignette" aria-hidden="true" />
        <div className="season1-world-beam season1-world-beam-a" aria-hidden="true" />
        <div className="season1-world-beam season1-world-beam-b" aria-hidden="true" />
        <div className="season1-world-beam season1-world-beam-c" aria-hidden="true" />
        <div className="season1-world-horizon" aria-hidden="true" />
        <div className="season1-world-particles" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
        </div>
        <div className="season1-world-visual" aria-hidden="true">
          <span className="season1-world-aura" />
          <span className="season1-world-halo" />
          <span className="season1-world-orbit season1-world-orbit-one" />
          <span className="season1-world-orbit season1-world-orbit-two" />
          <span className="season1-world-orbit season1-world-orbit-three" />
          <Image
            alt=""
            className="season1-world-image"
            fill
            priority
            sizes="(min-width: 1024px) 760px, 92vw"
            src={withBasePath("/images/season1/season1-connected-world-globe.png")}
          />
        </div>
        <div className="season1-world-title" aria-label="70-country world">
          <p>Season 1 / Connected World</p>
          <h2>70-COUNTRY WORLD</h2>
        </div>
  </>;
}
