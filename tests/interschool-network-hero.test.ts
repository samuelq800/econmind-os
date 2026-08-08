import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hero = readFileSync(
  "components/home/interschool-network-hero.tsx",
  "utf8",
);
const styles = readFileSync("app/globals.css", "utf8");

describe("Inter-school Network cover", () => {
  it("shows all fourteen participating schools in the agreed display order", () => {
    for (const school of [
      "Shandong Experimental High School",
      "Harrow Nanning",
      "Hangzhou Dingwen Academy",
      "Jiangsu Tianyi High School",
      "Beijing No.80 High School",
    ]) {
      expect(hero).toContain(school);
    }

    expect(hero).toContain("Fourteen schools · one economic world");
    expect(hero.indexOf("Suzhou High School-International Division")).toBeLessThan(
      hero.indexOf("Basis International School Shenzhen"),
    );
    expect(hero.indexOf("Hangzhou Dingwen Academy")).toBeLessThan(
      hero.indexOf("Harrow Nanning"),
    );
  });

  it("keeps the school roster on the right with its diagonal type treatment", () => {
    expect(hero).toContain('className="inter-school-lanes-list inter-school-lanes-list-right"');
    expect(hero).toContain('<li key={school.join(" ")}');
    expect(hero).toContain("const schoolsByLength");
    expect(hero).toContain("schoolLength(left) - schoolLength(right)");
    expect(hero).toContain("const upperRightSchools = [schools[0]");
    expect(hero).toContain("const lowerSchools = schoolsByLength.slice(6)");
    expect(styles).toContain("right:clamp(2rem,4vw,4.5rem)");
    expect(styles).toContain("font-style:italic");
    expect(styles).toContain("skewY(-7deg)");
    expect(styles).toContain("inter-school-league-title");
    expect(styles).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
  });
});
