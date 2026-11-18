import { describe, expect, it } from "vitest";
import { parseCertificateDate } from "../lib/credentials/date";
describe("certificate date parsing", () => {
  it.each([["17 November 2026","2026-11-17"],["1 Jan 2030","2030-01-01"],["2028-02-29","2028-02-29"]])("accepts %s", (input, expected) => expect(parseCertificateDate(input)).toBe(expected));
  it.each(["30 February 2027","2027-02-29","99 Wombat 2028","1999-12-31","2026-13-01",""])("rejects invalid %s", input => expect(parseCertificateDate(input)).toBeNull());
});
