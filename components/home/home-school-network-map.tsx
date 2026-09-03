"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinOff } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import type { LeagueDirectorySchool } from "@/lib/league/school-directory";
import { SCHOOL_LOCATION_SOURCE, schoolLocationAreaLabel, type SchoolCityLocation } from "@/lib/league/school-locations";
import { buildSchoolNetworkModel } from "@/lib/league/school-network";
import styles from "./home-school-network-map.module.css";

function mapPosition(location: SchoolCityLocation) {
  return {
    left: `${((location.longitude + 180) / 360) * 100}%`,
    top: `${((90 - location.latitude) / 180) * 100}%`,
  };
}

function pointDiameter(schoolCount: number) {
  return Math.min(32, Math.round(10 + Math.sqrt(schoolCount) * 6));
}

export function HomeSchoolNetworkMap({
  schools,
  syncStatus,
}: {
  schools: LeagueDirectorySchool[];
  syncStatus: "syncing" | "live" | "fallback";
}) {
  const model = useMemo(() => buildSchoolNetworkModel(schools), [schools]);
  const { hubs, unclassifiedEntries } = model;
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const selectedHub = hubs.find(({ location }) => location.locationKey === selectedLocationKey) ?? hubs[0] ?? null;
  const maxRegionCount = Math.max(1, unclassifiedEntries.length, ...model.regionGroups.map(({ entries }) => entries.length));
  const mapAsset = withBasePath("/league/maps/world-land.svg");

  return (
    <div className={styles.networkFrame}>
      <div className={styles.plate}>
        <div className={styles.mapPanel}>
          <div className={styles.mapRail} aria-hidden="true">
            <span>World distribution</span>
            <span>City centroids · WGS84</span>
          </div>

          <figure className={styles.figure}>
            <div
              className={styles.mapStage}
              role="img"
              aria-labelledby="school-network-map-title school-network-map-description"
            >
              <p id="school-network-map-title" className="sr-only">Worldwide distribution of participating League schools</p>
              <p id="school-network-map-description" className="sr-only">
                {model.mappedSchoolCount} schools are plotted at the centres of {hubs.length} cities. No national borders or campus addresses are shown.
              </p>
              <span
                className={styles.land}
                aria-hidden="true"
                style={{
                  WebkitMaskImage: `url("${mapAsset}")`,
                  maskImage: `url("${mapAsset}")`,
                }}
              />
              <ol className={styles.points} aria-hidden="true">
                {hubs.map((hub) => {
                  const selected = selectedHub?.location.locationKey === hub.location.locationKey;
                  const diameter = pointDiameter(hub.schools.length);
                  return (
                    <li
                      key={hub.location.locationKey}
                      className={`${styles.point} ${selected ? styles.pointSelected : ""}`}
                      style={{
                        ...mapPosition(hub.location),
                        width: `${diameter}px`,
                        height: `${diameter}px`,
                      }}
                    />
                  );
                })}
              </ol>
            </div>
            <figcaption className={styles.caption}>
              <span>Points represent city centres—not campus addresses. National borders are intentionally omitted.</span>
              <span>
                Land: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>
                {" · "}Locations: <a href={SCHOOL_LOCATION_SOURCE.documentationUrl} target="_blank" rel="noreferrer">GeoNames</a> ({SCHOOL_LOCATION_SOURCE.license})
              </span>
            </figcaption>
          </figure>
        </div>

        <aside className={styles.ledger} aria-labelledby="school-city-index-title">
          <div className={styles.primaryStat}>
            <span>Network footprint</span>
            <strong>{model.schoolCount}</strong>
            <p>participating schools</p>
          </div>

          <dl className={styles.summaryStats}>
            <div><dt>Mapped</dt><dd>{model.mappedSchoolCount}</dd></div>
            <div><dt>City hubs</dt><dd>{hubs.length}</dd></div>
            <div><dt>Not plotted</dt><dd>{unclassifiedEntries.length}</dd></div>
          </dl>

          {selectedHub && (
            <section className={styles.selection} aria-live="polite">
              <p>{schoolLocationAreaLabel(selectedHub.location)} · {selectedHub.location.administrativeArea ?? "City-state"}</p>
              <div>
                <h3>{selectedHub.location.city}</h3>
                <span>{selectedHub.schools.length} school{selectedHub.schools.length === 1 ? "" : "s"}</span>
              </div>
              <ul>
                {selectedHub.schools.slice(0, 3).map((school) => <li key={school.school_id}>{school.school_name}</li>)}
              </ul>
              {selectedHub.schools.length > 3 && <small>+ {selectedHub.schools.length - 3} more in the school directory</small>}
            </section>
          )}

          <div className={styles.cityIndex}>
            <div className={styles.cityIndexHeading}>
              <h3 id="school-city-index-title">City index</h3>
              <span>{hubs.length.toString().padStart(2, "0")}</span>
            </div>
            <div className={styles.cityButtons}>
              {hubs.map((hub) => {
                const selected = selectedHub?.location.locationKey === hub.location.locationKey;
                return (
                  <button
                    key={hub.location.locationKey}
                    type="button"
                    aria-label={`${hub.location.city}: ${hub.schools.length} school${hub.schools.length === 1 ? "" : "s"}`}
                    aria-pressed={selected}
                    className={selected ? styles.cityButtonSelected : undefined}
                    onClick={() => setSelectedLocationKey(hub.location.locationKey)}
                    onFocus={() => setSelectedLocationKey(hub.location.locationKey)}
                    onMouseEnter={() => setSelectedLocationKey(hub.location.locationKey)}
                  >
                    <span>{hub.location.city}</span>
                    <b>{hub.schools.length}</b>
                  </button>
                );
              })}
            </div>
          </div>

          {unclassifiedEntries.length > 0 && (
            <p className={styles.unmappedNotice}>
              <MapPinOff size={14} aria-hidden="true" />
              {unclassifiedEntries.length} public listing{unclassifiedEntries.length === 1 ? " is" : "s are"} withheld because no verified location key is available.
            </p>
          )}

          <p className={styles.syncStatus} data-status={syncStatus} role="status" aria-live="polite">
            {syncStatus === "syncing" && "Checking live school profiles…"}
            {syncStatus === "live" && "Live directory checked; verified roster remains available."}
            {syncStatus === "fallback" && "Live profile sync unavailable; verified roster remains available."}
          </p>
        </aside>
      </div>

      <section className={styles.partnerNetwork} aria-labelledby="partner-network-title">
        <div className={styles.partnerNetworkHeader}>
          <div>
            <p>Distribution register</p>
            <h3 id="partner-network-title">Partner network</h3>
          </div>
          <span>Verified city keys · no inferred positions</span>
        </div>

        <dl className={styles.partnerStats}>
          <div><dt>Schools</dt><dd>{model.schoolCount}</dd></div>
          <div><dt>Mapped cities</dt><dd>{model.mappedCityCount}</dd></div>
          <div><dt>Regions</dt><dd>{model.geographicRegionCount}</dd></div>
          <div><dt>Unclassified</dt><dd>{unclassifiedEntries.length}</dd></div>
        </dl>

        <div className={styles.regionRows}>
          {model.regionGroups.map((group) => (
            <div className={styles.regionRow} key={group.key}>
              <span>{group.label}</span>
              <strong>{group.entries.length}</strong>
              <i aria-hidden="true"><b style={{ width: `${(group.entries.length / maxRegionCount) * 100}%` }} /></i>
            </div>
          ))}
          {unclassifiedEntries.length > 0 && (
            <div className={`${styles.regionRow} ${styles.regionRowPending}`}>
              <span>Location pending</span>
              <strong>{unclassifiedEntries.length}</strong>
              <i aria-hidden="true"><b style={{ width: `${(unclassifiedEntries.length / maxRegionCount) * 100}%` }} /></i>
            </div>
          )}
        </div>

        <section className={styles.mappedRegister} aria-labelledby="mapped-school-register-title">
          <div className={styles.mappedRegisterHeading}>
            <div>
              <p>Verified locations</p>
              <h4 id="mapped-school-register-title">Mapped schools</h4>
            </div>
            <span>{model.mappedSchoolCount} schools · {hubs.length} cities</span>
          </div>
          <p className={styles.mappedRegisterNote}>Every plotted school is named here. Coordinates are city centroids, not campus addresses.</p>
          <div className={styles.mappedCityGrid}>
            {hubs.map((hub) => (
              <article className={styles.mappedCity} key={hub.location.locationKey}>
                <div>
                  <p>{schoolLocationAreaLabel(hub.location)}</p>
                  <h5>{hub.location.city}</h5>
                </div>
                <ul>{hub.schools.map((school) => <li key={school.school_id}>{school.school_name}</li>)}</ul>
                <small>{hub.location.longitude.toFixed(4)}°E · {hub.location.latitude.toFixed(4)}°N</small>
              </article>
            ))}
          </div>
        </section>
      </section>

      <Link href="/league/schools/" className={styles.directoryLink}>
        <span>View all participating schools</span>
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
