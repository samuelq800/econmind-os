import { describe, expect, it } from "vitest";
import { mergeLeagueDirectory } from "@/lib/league/school-directory";
import {
  publicDirectorySnapshot,
  publicDirectorySnapshotUpdatedAt,
} from "@/lib/league/public-directory-snapshot";

describe("static public League directory", () => {
  it("renders the approved public directory into the export instead of only the old editorial roster", () => {
    expect(Number.isNaN(Date.parse(publicDirectorySnapshotUpdatedAt))).toBe(false);
    expect(publicDirectorySnapshot.length).toBeGreaterThan(33);
    expect(new Set(publicDirectorySnapshot.map((school) => school.school_id)).size)
      .toBe(publicDirectorySnapshot.length);
    expect(mergeLeagueDirectory(publicDirectorySnapshot).length)
      .toBeGreaterThanOrEqual(publicDirectorySnapshot.length);
  });
});
