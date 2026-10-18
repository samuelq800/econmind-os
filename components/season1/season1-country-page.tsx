"use client";
import { useAuth } from "@/components/auth/auth-provider";
import { Season1CountryPreferences } from "./season1-country-preferences";
import { Season1WorldMap } from "./season1-world-map";
import { Season1WorkspaceNav } from "./season1-workspace-nav";
import { Season1CountryHero } from "./season1-country-hero";

export function Season1CountryPage() {
  const { user, loading, roleLoading, openAuth } = useAuth();
  return (
    <main className="season1-lobby min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="s1-country-page-content">
        <Season1WorkspaceNav active="countries" />
        <Season1CountryHero />
        <Season1WorldMap />
        {loading || roleLoading ? (
          <p role="status">Checking your account…</p>
        ) : user ? (
          <Season1CountryPreferences key={user.id} userId={user.id} />
        ) : (
          <section className="s1-country-panel">
            <h2>Sign in to choose a country.</h2>
            <p>A captain can submit for a locked team of at least 3 members.</p>
            <button
              className="s1-country-primary"
              onClick={() => openAuth("sign-in")}
            >
              Sign in
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
