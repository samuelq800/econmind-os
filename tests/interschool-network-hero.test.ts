import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hero = readFileSync(
  "components/home/interschool-network-hero.tsx",
  "utf8",
);

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
});
