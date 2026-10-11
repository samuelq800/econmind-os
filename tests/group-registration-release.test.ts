import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  assertCodeHash,
  fingerprint,
  runRelease,
  PROJECT,
} from "../scripts/deploy-group-registration.mjs";

describe("bounded group release", () => {
  it("executes prepare and activate without modifying Auth and closes uncertain activation", async () => {
    const migration = await readFile(
      "supabase/migrations/20261011120000_group_registration.sql",
      "utf8",
    );
    const config = {
      mailer_autoconfirm: false,
      external_google_enabled: true,
      mailer_otp_exp: 3600,
    };
    const queries: string[] = [];
    let state = "";
    let failActivation = false;
    const fetcher: typeof fetch = async (url, init) => {
      expect(String(url)).toMatch(
        new RegExp(`^https://api.supabase.com/v1/projects/${PROJECT}/`),
      );
      if (String(url).endsWith("config/auth")) {
        expect(init?.method).toBe("GET");
        return new Response(JSON.stringify(config));
      }
      expect(String(url).endsWith("database/query")).toBe(true);
      const query = JSON.parse(String(init?.body)).query as string;
      queries.push(query);
      if (failActivation && query.includes("enabled=true"))
        return new Response("", { status: 500 });
      return new Response("[]");
    };
    const options = {
      statePath: "runner-state",
      token: "disposable-token",
      project: PROJECT,
      fetcher,
      read: async (path: string) =>
        path === "runner-state" ? state : migration.replace(/\r?\n/g, "\r\n"),
      write: async (_path: string, value: string) => {
        state = value;
      },
      log: () => {},
    };
    await runRelease({ ...options, phase: "prepare" });
    expect(state).toContain("authFingerprint");
    expect(queries[0]).toContain("begin;");
    expect(queries[0]).toContain("schema_migrations");
    expect(queries[0]).toContain("commit;");
    await runRelease({
      ...options,
      phase: "activate",
      codeHash: "a".repeat(64),
    });
    expect(queries[1]).toContain("enabled=true");
    failActivation = true;
    await expect(
      runRelease({ ...options, phase: "activate", codeHash: "a".repeat(64) }),
    ).rejects.toThrow("HTTP 500");
    expect(queries.at(-1)).toContain("enabled=false");
  });
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
