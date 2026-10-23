import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { RegistrationPolicyFields } from "@/components/legal/registration-policy-fields";
import { ACKNOWLEDGEMENT_DOCUMENTS } from "@/lib/legal/acknowledgement";
import { emptyRegistrationConsent } from "@/lib/legal/legal-config";
import {
  registrationPolicyMetadata,
  registrationConsentComplete,
  rememberOAuthRegistrationConsent,
  pendingOAuthRegistrationConsent,
  clearOAuthRegistrationConsent,
} from "@/lib/legal/registration-consent";
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const policies = Object.fromEntries(
  ACKNOWLEDGEMENT_DOCUMENTS.map(({ key }) => [key, true]),
);
describe("all current registration policy receipts", () => {
  it("loads the actual Edge handler dependency graph in native Node strip-only mode", () => {
    expect(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "--input-type=module",
          "-e",
          "await import('./supabase/functions/_shared/group-registration.ts'); await import('./supabase/functions/_shared/direct-registration.ts'); console.log('REGISTRATION_MODULES_OK')",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    ).toContain("REGISTRATION_MODULES_OK");
  });
  it("renders eight individually required and unchecked versioned documents, including World", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegistrationPolicyFields, {
        value: emptyRegistrationConsent(),
        onChange: vi.fn(),
      }),
    );
    expect(html.match(/type="checkbox"/g)).toHaveLength(8);
    expect(html).not.toContain("checked=");
    for (const document of ACKNOWLEDGEMENT_DOCUMENTS)
      expect(html).toContain(document.route.replace(/\/$/, ""));
    expect(html).toContain("v2.0");
    expect(html).toContain("2026-10-21");
    expect(html).not.toContain("v1.2");
    expect(registrationConsentComplete(emptyRegistrationConsent())).toBe(false);
    expect(
      registrationPolicyMetadata({ terms: true, privacy: true }),
    ).toBeUndefined();
  });
  it("carries explicit consent across OAuth once, but not stale or partial drafts", () => {
    const map = new Map<string, string>();
    const storage = {
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      getItem: (k: string) => map.get(k) ?? null,
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
    expect(() =>
      rememberOAuthRegistrationConsent(
        emptyRegistrationConsent(),
        storage,
        100,
      ),
    ).toThrow();
    rememberOAuthRegistrationConsent(
      { terms: true, privacy: true, policies },
      storage,
      100,
    );
    expect(pendingOAuthRegistrationConsent(storage, 101)).toEqual(policies);
    clearOAuthRegistrationConsent(storage);
    expect(pendingOAuthRegistrationConsent(storage, 102)).toBeNull();
    rememberOAuthRegistrationConsent(
      { terms: true, privacy: true, policies },
      storage,
      100,
    );
    expect(pendingOAuthRegistrationConsent(storage, 1_800_101)).toBeNull();
  });
  it("uses the same current-policy fields in every registration and onboarding form", () => {
    for (const file of [
      "components/auth/auth-dialog.tsx",
      "components/auth/account-onboarding.tsx",
      "components/auth/direct-registration-page.tsx",
    ])
      expect(readFileSync(file, "utf8")).toContain("<RegistrationPolicyFields");
    expect(readFileSync("components/auth/auth-dialog.tsx", "utf8")).toMatch(
      /policy_acknowledgement:\s*registrationPolicyMetadata\(\s*legalAcceptance/,
    );
    expect(
      readFileSync("lib/supabase/policy-acknowledgement.ts", "utf8"),
    ).toContain("await policyAcknowledgementApi.save(userId, pending)");
    expect(readFileSync("app/register/direct/page.tsx", "utf8")).toMatch(
      /index: false/,
    );
  });
});
