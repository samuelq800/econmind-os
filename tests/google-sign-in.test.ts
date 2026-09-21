import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasInitialLegalConsent, LEGAL_DOCUMENTS, LEGAL_RECONSENT, needsLegalReconsent } from "@/lib/legal/legal-config";
import { googleSignInRedirectUrl, missingProfileMetadata, profileMetadataFallback } from "@/lib/supabase/google-sign-in";

const dialog = readFileSync("components/auth/auth-dialog.tsx", "utf8");
const provider = readFileSync("components/auth/auth-provider.tsx", "utf8");
const onboarding = readFileSync("components/auth/account-onboarding.tsx", "utf8");
const shell = readFileSync("components/layout/application-shell.tsx", "utf8");

describe("Google sign-in with the existing Supabase account", () => {
  it("returns only to the current site with the configured base path", () => {
    expect(googleSignInRedirectUrl("https://econmind.group", "")).toBe("https://econmind.group/?auth=google");
    expect(googleSignInRedirectUrl("https://samuelq800.github.io", "/econmind-os")).toBe("https://samuelq800.github.io/econmind-os/?auth=google");
    expect(() => googleSignInRedirectUrl("https://attacker.example/path", "")).toThrow();
    expect(dialog).toContain('provider: "google"');
    expect(dialog).toContain("googleSignInRedirectUrl(window.location.origin)");
    expect(dialog).toContain("signInWithOAuth");
    expect(dialog).toContain("Continue with Google");
    expect(dialog).toContain("function GoogleMark()");
    expect(dialog).toContain('aria-hidden="true"');
    expect(dialog).toContain('fill="#4285F4"');
    expect(provider).toContain('currentUrl.searchParams.delete("auth")');
    expect(provider).toContain('for (const key of ["code", "error", "error_code", "error_description"])');
    expect(provider).toContain('fragment.has("access_token")');
  });

  it("initializes only missing user-controlled profile fields", () => {
    const metadata = { display_name: "  Preferred  ", full_name: "Google Name", name: "Other Name", avatar_url: "https://example.com/avatar.png" };
    expect(profileMetadataFallback(metadata)).toEqual({ displayName: "Preferred", avatarUrl: "https://example.com/avatar.png" });
    expect(profileMetadataFallback({ full_name: "Full", name: "Short" }).displayName).toBe("Full");
    expect(profileMetadataFallback({ name: "Short" }).displayName).toBe("Short");
    expect(profileMetadataFallback({ name: "x".repeat(100) }).displayName).toHaveLength(80);
    expect(profileMetadataFallback({ avatar_url: "javascript:alert(1)" }).avatarUrl).toBeNull();
    expect(missingProfileMetadata({ display_name: "Edited", avatar_url: "https://example.com/mine" }, metadata)).toEqual({ displayName: null, avatarUrl: null });
    expect(provider).toContain('.eq("user_id", user.id)');
    expect(provider).toContain('.is("display_name", null)');
    expect(provider).toContain('.is("avatar_url", null)');
    expect(provider).toContain('data?.account_status === "suspended"');
  });

  it("requires explicit initial acknowledgement for unfinished accounts without repeating valid signup consent", () => {
    const current = [
      { document_type: "terms", document_version: LEGAL_DOCUMENTS.terms.version },
      { document_type: "privacy", document_version: LEGAL_DOCUMENTS.privacy.version },
    ];
    expect(hasInitialLegalConsent([])).toBe(false);
    expect(hasInitialLegalConsent(current.slice(0, 1))).toBe(false);
    expect(hasInitialLegalConsent(current)).toBe(true);
    expect(LEGAL_RECONSENT.terms).toBe(false);
    expect(LEGAL_RECONSENT.privacy).toBe(false);
    expect(needsLegalReconsent({})).toBe(false);
    expect(onboarding).toContain("registrationConsentValid(legalAcceptance)");
    expect(onboarding).toContain("acceptCurrentLegalDocuments(LEGAL_DOCUMENTS.terms.version, LEGAL_DOCUMENTS.privacy.version)");
    expect(onboarding).toContain("if (profile.onboarding_path)");
    expect(onboarding).toContain("Checking account setup…");
  });

  it("preserves email flows and keeps anonymous room identities separate", () => {
    for (const action of ["signInWithPassword", "auth.signUp", "verifyOtp", "resetPasswordForEmail", "PASSWORD_RECOVERY"]) {
      expect(dialog + provider).toContain(action);
    }
    expect(shell).toContain("if (isStandaloneLiveWorld(pathname)) return <>{children}</>");
    expect(readFileSync("lib/supabase/live-world.ts", "utf8")).toContain('storageKey: "econmind-live-world-session"');
    expect(readFileSync("lib/supabase/live-auction.ts", "utf8")).toContain('storageKey: "econmind-live-auction-session"');
    expect(readFileSync("lib/supabase/account-deletion.ts", "utf8")).toContain('rpc("delete_self_personal_account"');
    expect(readFileSync("lib/supabase/viewer-invitations.ts", "utf8")).toContain('rpc("validate_viewer_invitation_code"');
    expect(dialog + provider).not.toContain("GOOGLE_CLIENT_SECRET");
  });
});
