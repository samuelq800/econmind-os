import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LeagueDirectorySchool } from "@/lib/league/school-directory";
import { buildSchoolNetworkModel } from "@/lib/league/school-network";
import styles from "./school-directory-ledger.module.css";

export function SchoolDirectoryLedger({
  schools,
  compact = false,
}: {
  schools: LeagueDirectorySchool[];
  compact?: boolean;
}) {
  const model = buildSchoolNetworkModel(schools);
  const indexedGroups = model.directoryGroups.map((group, groupIndex) => ({
    group,
    groupIndex,
    startIndex: model.directoryGroups
      .slice(0, groupIndex)
      .reduce((total, previousGroup) => total + previousGroup.entries.length, 0),
  }));

  return (
    <section className={`${styles.ledger} ${compact ? styles.compact : ""}`} aria-labelledby="school-register-title">
      <header className={styles.header}>
        <div>
          <p>Complete school register</p>
          <h3 id="school-register-title">Every participating school, in one ledger.</h3>
        </div>
        <p className={styles.headerNote}>
          Full names remain visible. Map status reflects verified city keys, not inferred campus locations.
        </p>
      </header>

      <div className={styles.groups}>
        {indexedGroups.map(({ group, groupIndex, startIndex }) => (
            <section className={styles.group} key={group.key} aria-labelledby={`school-group-${groupIndex}`}>
              <header className={styles.groupHeader}>
                <span>{String(groupIndex + 1).padStart(2, "0")}</span>
                <div>
                  <h4 id={`school-group-${groupIndex}`}>{group.label}</h4>
                  <p>{group.entries.length} school{group.entries.length === 1 ? "" : "s"}</p>
                </div>
              </header>

              <ol className={styles.rows} start={startIndex + 1}>
                {group.entries.map((entry, index) => {
                  const school = entry.school;
                  const mapped = Boolean(entry.location);
                  const cityLabel = entry.location?.city
                    ?? (school.city && school.city !== "League partner" ? `${school.city} · unverified` : "Location not verified");

                  return (
                    <li key={school.school_id}>
                      <span className={styles.rowNumber}>{String(startIndex + index + 1).padStart(2, "0")}</span>
                      <div className={styles.schoolIdentity}>
                        <strong>{school.school_name}</strong>
                        <span>{cityLabel}</span>
                      </div>
                      <span className={styles.activity}>
                        {school.team_count > 0
                          ? `${school.team_count} active team${school.team_count === 1 ? "" : "s"}`
                          : "Team profile pending"}
                      </span>
                      <span className={styles.locationStatus} data-mapped={mapped}>
                        {mapped ? "Mapped" : "Pending"}
                      </span>
                      <Link
                        href={`/league/schools/profile/?school=${encodeURIComponent(school.school_name)}`}
                        aria-label={`Open ${school.school_name} profile`}
                      >
                        <span>Profile</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
      </div>
    </section>
  );
}
