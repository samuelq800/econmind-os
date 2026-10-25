import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { shouldGoHomeAfterAuth } from "@/lib/supabase/post-auth-navigation";
describe("one-time homepage redirect", () => {
  it("still redirects once after an actual password login following empty initialization", async () => {
    const user = {
      id: "00000000-0000-4000-8000-000000000002",
      aud: "authenticated",
      is_anonymous: false,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    };
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`;
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            user,
            access_token: accessToken,
            refresh_token: "synthetic-refresh",
            token_type: "bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const client = createClient(
      "https://diagnostic.invalid",
      "synthetic-public-key",
      {
        auth: {
          storageKey: "navigation-password-login",
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch },
      },
    );
    let ready = false;
    let previousUserId: string | null = null;
    const redirects: string[] = [];
    let initial!: () => void;
    const initialized = new Promise<void>((resolve) => {
      initial = resolve;
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (
        shouldGoHomeAfterAuth(
          event,
          previousUserId,
          session?.user ?? null,
          false,
          ready,
        )
      )
        redirects.push("/");
      previousUserId = session?.user?.id ?? null;
      if (event === "INITIAL_SESSION") {
        ready = true;
        initial();
      }
    });
    try {
      await initialized;
      expect(redirects).toEqual([]);
      const { error } = await client.auth.signInWithPassword({
        email: "synthetic@example.com",
        password: "synthetic-test-only",
      });
      expect(error).toBeNull();
      expect(redirects).toEqual(["/"]);
      expect(fetch).toHaveBeenCalledOnce();
      expect(String(fetch.mock.calls[0][0])).toContain("grant_type=password");
    } finally {
      data.subscription.unsubscribe();
      await client.auth.stopAutoRefresh();
    }
  });
  it("redirects new sign-ins and account switches", () => {
    expect(
      shouldGoHomeAfterAuth("SIGNED_IN", null, { id: "new" }, false, true),
    ).toBe(true);
    expect(
      shouldGoHomeAfterAuth("SIGNED_IN", "old", { id: "new" }, false, true),
    ).toBe(true);
  });
  it("does not interrupt page loads, focus sign-in events, recovery, anonymous rooms or token refresh", () => {
    for (const event of [
      "INITIAL_SESSION",
      "TOKEN_REFRESHED",
      "USER_UPDATED",
      "PASSWORD_RECOVERY",
      "SIGNED_OUT",
    ])
      expect(
        shouldGoHomeAfterAuth(event, null, { id: "user" }, false, true),
      ).toBe(false);
    expect(
      shouldGoHomeAfterAuth("SIGNED_IN", "user", { id: "user" }, false, true),
    ).toBe(false);
    expect(
      shouldGoHomeAfterAuth(
        "SIGNED_IN",
        null,
        { id: "room", is_anonymous: true },
        false,
        true,
      ),
    ).toBe(false);
    expect(
      shouldGoHomeAfterAuth("SIGNED_IN", null, { id: "user" }, true, true),
    ).toBe(false);
    expect(shouldGoHomeAfterAuth("SIGNED_IN", null, null, false, true)).toBe(
      false,
    );
  });

  it("never interprets startup SIGNED_IN as a new login before INITIAL_SESSION", () => {
    expect(
      shouldGoHomeAfterAuth(
        "SIGNED_IN",
        null,
        { id: "existing" },
        false,
        false,
      ),
    ).toBe(false);
    const provider = readFileSync("components/auth/auth-provider.tsx", "utf8");
    expect(provider).toContain("const initialSessionReady = useRef(false)");
    expect(provider).toContain(
      'if (event === "INITIAL_SESSION") initialSessionReady.current = true',
    );
    expect(provider).toContain("sessionWasInitialized,");
  });

  it.each([false, true])(
    "preserves a saved account's route with actual SDK initialization (expired=%s)",
    async (expired) => {
      const user = {
        id: "00000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        is_anonymous: false,
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      };
      const encode = (value: unknown) =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -120 : 3600);
      const session = {
        access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: expiresAt })}.synthetic`,
        refresh_token: "synthetic-refresh",
        token_type: "bearer",
        expires_at: expiresAt,
        expires_in: 3600,
        user,
      };
      const key = `navigation-regression-${expired}`;
      const storage = new Map([[key, JSON.stringify(session)]]);
      const fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...session,
            expires_at: undefined,
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = createClient(
        "https://diagnostic.invalid",
        "synthetic-public-key",
        {
          auth: {
            storageKey: key,
            storage: {
              getItem: (name) => storage.get(name) ?? null,
              setItem: (name, value) => {
                storage.set(name, value);
              },
              removeItem: (name) => {
                storage.delete(name);
              },
            },
            autoRefreshToken: expired,
            detectSessionInUrl: false,
          },
          global: { fetch },
        },
      );
      let ready = false;
      let previousUserId: string | null = null;
      const events: string[] = [];
      const redirects: string[] = [];
      let initial!: () => void;
      const initialized = new Promise<void>((resolve) => {
        initial = resolve;
      });
      const { data } = client.auth.onAuthStateChange((event, next) => {
        events.push(event);
        if (
          shouldGoHomeAfterAuth(
            event,
            previousUserId,
            next?.user ?? null,
            false,
            ready,
          )
        )
          redirects.push("/");
        previousUserId = next?.user?.id ?? null;
        if (event === "INITIAL_SESSION") {
          ready = true;
          initial();
        }
      });
      try {
        await initialized;
        expect(events).toContain("INITIAL_SESSION");
        expect(events).toContain(expired ? "TOKEN_REFRESHED" : "SIGNED_IN");
        expect(redirects).toEqual([]);
        if (!expired) expect(fetch).not.toHaveBeenCalled();
        expect((await client.auth.getSession()).data.session?.user.id).toBe(
          user.id,
        );
      } finally {
        data.subscription.unsubscribe();
        await client.auth.stopAutoRefresh();
      }
    },
  );
});
