import Image from "next/image";
import { ExternalLink, Map } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import map from "@/lib/season1/world-map.json";
import { WORLD_URL } from "@/lib/season1/countries";
import "./season1-country-preferences.css";

export function Season1WorldMap() {
  return (
    <section className="s1-world-map" aria-labelledby="s1-map-heading">
      <div className="s1-world-map-heading">
        <div>
          <p className="s1-country-eyebrow">ASTERRA / WORLD OVERVIEW</p>
          <h2 id="s1-map-heading">
            <Map size={23} /> A connected world. 70 starting points.
          </h2>
        </div>
        <a
          href={withBasePath(map.image)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open full map <ExternalLink size={15} />
        </a>
      </div>
      <a
        className="s1-world-map-image"
        href={withBasePath(map.image)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the full-size Asterra world map with country codes 01 to 70"
      >
        <Image
          unoptimized
          src={withBasePath(map.image)}
          width={map.width}
          height={map.height}
          alt="Asterra world map from EconMind World, with borders and country codes 01 to 70"
        />
      </a>
      <div className="s1-world-map-caption">
        <span>
          Country numbers match the selection cards below. Open the full map to
          zoom.
        </span>
        <a href={WORLD_URL} target="_blank" rel="noopener noreferrer">
          Explore World <ExternalLink size={13} />
        </a>
      </div>
      <p className="s1-world-map-note">
        Geographic reference from EconMind World. This map does not indicate
        country availability or official allocations.
      </p>
    </section>
  );
}
