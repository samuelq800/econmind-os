import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, needsLegalReconsent, registrationConsentValid } from "@/lib/legal/legal-config";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "@/lib/legal/legal-content";
import { pageAccessForPath } from "@/lib/platform/access-control";
import { legalAcknowledgementErrorMessage } from "@/lib/supabase/governance";

const migration = readFileSync("supabase/migrations/20260823000000_governance_privacy_legal.sql", "utf8");
const currentLegalMigration = readFileSync("supabase/migrations/20260921010000_activate_current_legal_documents.sql", "utf8").replace(/\r\n/g, "\n");
const authDialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");
const about = readFileSync("app/about/page.tsx", "utf8");
const featureFlags = readFileSync("lib/platform/feature-flags.ts", "utf8");

describe("governance, privacy, and legal foundation", () => {
  it("requires both legal acknowledgements for a new account", () => {
    expect(registrationConsentValid({ terms: false, privacy: false })).toBe(false);
    expect(registrationConsentValid({ terms: true, privacy: false })).toBe(false);
    expect(registrationConsentValid({ terms: false, privacy: true })).toBe(false);
    expect(registrationConsentValid({ terms: true, privacy: true })).toBe(true);
    expect(authDialog).toContain("legal_acceptance");
    expect(authDialog).toContain("Terms of Use");
    expect(authDialog).toContain("Privacy Notice");
  });

  it("does not interrupt existing accounts while reconsent is disabled", () => {
    expect(needsLegalReconsent({
      terms: LEGAL_DOCUMENTS.terms.version,
      privacy: LEGAL_DOCUMENTS.privacy.version,
    })).toBe(false);
    expect(needsLegalReconsent({})).toBe(false);
  });

  it("registers the exact current legal versions required by first-time setup", () => {
    expect(currentLegalMigration).toContain("'terms',\n    '1.2'");
    expect(currentLegalMigration).toContain("'privacy',\n    '1.1'");
    expect(currentLegalMigration).toContain("status = 'retired'");
    expect(legalAcknowledgementErrorMessage(new Error("The requested legal document version is not active"))).toContain("being activated");
    expect(legalAcknowledgementErrorMessage(new Error("network unavailable"))).toBe("Could not save your acknowledgement. Please try again.");
  });

  it("explains the optional Google Sign-In data boundary in public legal copy", () => {
    const googleSection = PRIVACY_SECTIONS.find((section) => section.id === "google-sign-in");
    expect(googleSection?.heading).toBe("3. Google Sign-In");
    expect(googleSection?.bullets?.join(" ")).toContain("Google Drive, Gmail, Calendar, contacts");
    expect(googleSection?.bullets?.join(" ")).toContain("does not receive or store your Google password");
    expect(googleSection?.bullets?.join(" ")).toContain("not public");
    expect(TERMS_SECTIONS.find((section) => section.id === "accounts")?.paragraphs?.join(" ")).toContain("Google Sign-In is optional");
  });

  it("exposes legal pages publicly but requires an individual account for contact", () => {
    for (const path of ["/about", "/privacy", "/terms", "/community-guidelines", "/integrity"]) {
      expect(pageAccessForPath(path).audience).toBe("public");
    }
    expect(pageAccessForPath("/contact").audience).toBe("account");
    expect(pageAccessForPath("/admin/governance").platformRoles).toEqual(["platform_admin"]);
  });

  it("makes the full About statement a primary public destination", () => {
    expect(featureFlags).toContain('id: "about", label: "About", href: "/about", system: "shared"');
    expect(about).toContain("Economics beyond the classroom.");
    expect(about).toContain("Student-initiated. Independently operated. Non-profit in purpose.");
    expect(about).toContain("A modelled result is an outcome within a set of assumptions");
    expect(about).toContain("not designed to solicit personal information from children under 14");
  });

  it("keeps user requests, legal acknowledgements, and internal audit history behind RLS", () => {
    for (const table of ["legal_document_versions", "user_consents", "support_requests", "moderation_actions"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("create policy support_requests_select_own");
    expect(migration).toContain("create policy moderation_actions_admin_select");
    expect(migration).toContain("create or replace function public.review_support_request");
    expect(migration).toContain("Platform administrator role required");
    expect(migration).not.toContain("service_role");
  });
});
