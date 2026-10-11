import { describe, expect, it } from "vitest";
import {
  assertCodeHash,
  fingerprint,
} from "../scripts/deploy-group-registration.mjs";

describe("bounded group release", () => {
  it("accepts only a protected SHA-256 value, never executable input", () => {
    expect(assertCodeHash("a".repeat(64))).toBe("a".repeat(64));
    for (const value of [
      undefined,
      "",
      "a".repeat(63),
      "ABC",
      "';select 1;--",
    ]) {
      expect(() => assertCodeHash(value)).toThrow();
    }
  });
  it("detects changes to email, OAuth and recovery settings independently of key order", () => {
    const before = {
      mailer_autoconfirm: false,
      external_google_enabled: true,
      mailer_otp_exp: 3600,
    };
    expect(fingerprint(before)).toBe(
      fingerprint({
        mailer_otp_exp: 3600,
        external_google_enabled: true,
        mailer_autoconfirm: false,
      }),
    );
    expect(fingerprint(before)).not.toBe(
      fingerprint({ ...before, external_google_enabled: false }),
    );
    expect(fingerprint(before)).not.toBe(
      fingerprint({ ...before, mailer_autoconfirm: true }),
    );
  });
});
