import { schoolLocationAreaLabel } from "@/lib/league/school-locations";
import type { LeagueDirectorySchool } from "@/lib/league/school-directory";
import styles from "./home-mapped-school-register.module.css";

type CityGroup = {
  city: string;
  area: string;
  administrativeArea: string | null;
  latitude: number;
  longitude: number;
  schools: LeagueDirectorySchool[];
};

function groupedMappedSchools(schools: LeagueDirectorySchool[]): CityGroup[] {
  const groups = new Map<string, CityGroup>();

  for (const school of schools) {
    const location = school.mapLocation;
    if (!location) continue;

    const existing = groups.get(location.locationKey);
    if (existing) {
      existing.schools.push(school);
      continue;
    }

    groups.set(location.locationKey, {
      city: location.city,
      area: schoolLocationAreaLabel(location),
      administrativeArea: location.administrativeArea,
      latitude: location.latitude,
      longitude: location.longitude,
      schools: [school],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      schools: group.schools.toSorted((left, right) => left.school_name.localeCompare(right.school_name, "en")),
    }))
    .toSorted((left, right) => left.city.localeCompare(right.city, "en"));
}

export function HomeMappedSchoolRegister({ schools }: { schools: LeagueDirectorySchool[] }) {
  const cities = groupedMappedSchools(schools);
  const mappedSchoolCount = cities.reduce((total, city) => total + city.schools.length, 0);

  return (
    <section className={styles.register} aria-labelledby="mapped-school-register-title">
      <header className={styles.header}>
        <div>
          <p>Verified locations</p>
          <h3 id="mapped-school-register-title">Mapped school register</h3>
        </div>
        <span>{mappedSchoolCount} schools · {cities.length} city hubs · WGS84</span>
      </header>

      <p className={styles.intro}>
        Every school with a reviewed city coordinate is listed below. Coordinates identify city centroids, never campus addresses.
      </p>

      <div className={styles.cityGrid}>
        {cities.map((city) => (
          <article className={styles.cityCard} key={`${city.city}-${city.latitude}-${city.longitude}`}>
            <div className={styles.cityHeading}>
              <div>
                <p>{city.area}{city.administrativeArea ? ` · ${city.administrativeArea}` : ""}</p>
                <h4>{city.city}</h4>
              </div>
              <span>{city.schools.length} school{city.schools.length === 1 ? "" : "s"}</span>
            </div>
            <ul>
              {city.schools.map((school) => <li key={school.school_id}>{school.school_name}</li>)}
            </ul>
            <p className={styles.coordinates}>{city.longitude.toFixed(4)}°E · {city.latitude.toFixed(4)}°N</p>
          </article>
        ))}
      </div>
    </section>
  );
}
