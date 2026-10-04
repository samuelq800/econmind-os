import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseProxyFetch } from "../lib/supabase/browser-transport";
import { createGatewayHandler } from "../infra/cloudflare/supabase-gateway/src/proxy";

const upstreamOrigin = "https://test-project.supabase.co";
const gatewayOrigin = "https://api.econmind.example";
const siteOrigin = "https://econmind.example";
const publicKey = "test-public-key";

function request(path = "/auth/v1/signup", init: RequestInit = {}) {
  return new Request(`${gatewayOrigin}${path}`, {
    ...init,
    headers: {
      origin: siteOrigin,
      apikey: publicKey,
      ...Object.fromEntries(new Headers(init.headers)),
    },
  });
}

describe("Supabase browser gateway transport", () => {
  it.each([
    ["string", "original-body"],
    ["Blob", new Blob(["original-body"], { type: "text/plain" })],
  ] as const)(
    "preserves %s URL-and-init uploads with keepalive",
    async (_kind, body) => {
      const controller = new AbortController();
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response());
      const transport = createSupabaseProxyFetch(
        upstreamOrigin,
        gatewayOrigin,
        fetchImplementation,
      );
      await transport(
        `${upstreamOrigin}/storage/v1/object/test/file?upsert=true`,
        {
          method: "POST",
          headers: { apikey: publicKey, "content-type": "text/plain" },
          body,
          signal: controller.signal,
          keepalive: true,
          credentials: "include",
        },
      );
      expect(fetchImplementation).toHaveBeenCalledOnce();
      const forwarded = fetchImplementation.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe(
        `${gatewayOrigin}/storage/v1/object/test/file?upsert=true`,
      );
      expect(await forwarded.text()).toBe("original-body");
      expect(forwarded.headers.get("apikey")).toBe(publicKey);
      expect(forwarded.keepalive).toBe(true);
      expect(forwarded.credentials).toBe("omit");
      controller.abort();
      expect(forwarded.signal.aborted).toBe(true);
    },
  );

  it("preserves method, body, headers, query and cancellation while omitting cookies", async () => {
    const controller = new AbortController();
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("ok"));
    const transport = createSupabaseProxyFetch(
      upstreamOrigin,
      gatewayOrigin,
      fetchImplementation,
    );
    const original = new Request(
      `${upstreamOrigin}/auth/v1/signup?redirect_to=https%3A%2F%2Feconmind.example`,
      {
        method: "POST",
        headers: {
          apikey: publicKey,
          authorization: "Bearer user-jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "person@example.test",
          password: "local-test-password",
        }),
        signal: controller.signal,
        credentials: "include",
      },
    );
    await transport(original);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const forwarded = fetchImplementation.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe(
      `${gatewayOrigin}/auth/v1/signup?redirect_to=https%3A%2F%2Feconmind.example`,
    );
    expect(forwarded.method).toBe("POST");
    expect(forwarded.headers.get("apikey")).toBe(publicKey);
    expect(forwarded.headers.get("authorization")).toBe("Bearer user-jwt");
    expect(await forwarded.json()).toEqual({
      email: "person@example.test",
      password: "local-test-password",
    });
    expect(forwarded.credentials).toBe("omit");
    controller.abort();
    expect(forwarded.signal.aborted).toBe(true);
  });

  it("never replays a failed write against the original host", async () => {
    const failure = new TypeError("Failed to fetch");
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValue(failure);
    const transport = createSupabaseProxyFetch(
      upstreamOrigin,
      gatewayOrigin,
      fetchImplementation,
    );
    await expect(
      transport(`${upstreamOrigin}/auth/v1/signup`, {
        method: "POST",
        body: "signup",
      }),
    ).rejects.toBe(failure);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect((fetchImplementation.mock.calls[0][0] as Request).url).toBe(
      `${gatewayOrigin}/auth/v1/signup`,
    );
  });

  it("leaves unrelated hosts unchanged", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response());
    const transport = createSupabaseProxyFetch(
      upstreamOrigin,
      gatewayOrigin,
      fetchImplementation,
    );
    const init = { headers: { "x-custom": "value" } };
    await transport("https://third-party.example/file", init);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://third-party.example/file",
      init,
    );
  });

  it.each([
    "http://api.example",
    "https://user:password@api.example",
    "https://api.example/path",
    "https://api.example?target=other",
    "https://api.example#fragment",
  ])("rejects proxy configuration that is not an HTTPS origin: %s", (proxy) => {
    expect(() => createSupabaseProxyFetch(upstreamOrigin, proxy)).toThrow(
      "HTTPS origin",
    );
  });

  it("keeps the original SDK session namespace and Google authorize URL", async () => {
    const keys: string[] = [];
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "local-user",
        email: "person@example.test",
        identities: [],
      }),
    );
    const client = createClient(upstreamOrigin, publicKey, {
      global: {
        fetch: createSupabaseProxyFetch(
          upstreamOrigin,
          gatewayOrigin,
          fetchImplementation,
        ),
      },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) => {
            keys.push(key);
            return null;
          },
          setItem: () => {},
          removeItem: () => {},
        },
      },
    });
    await client.auth.getSession();
    expect(keys).toContain("sb-test-project-auth-token");
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: { skipBrowserRedirect: true, redirectTo: `${siteOrigin}/` },
    });
    expect(result.error).toBeNull();
    const authorize = new URL(result.data.url!);
    expect(authorize.origin).toBe(upstreamOrigin);
    expect(authorize.pathname).toBe("/auth/v1/authorize");
    expect(authorize.searchParams.get("provider")).toBe("google");
    expect(authorize.searchParams.get("redirect_to")).toBe(`${siteOrigin}/`);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});

describe("fixed Supabase gateway", () => {
  it("allows mail preflight and forwards the request ID through the SDK without retrying", async () => {
    const requestId = "local-mail-request-id";
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ok: false, request_id: requestId }, { status: 403 }),
      );
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    const preflight = await handler(
      request("/functions/v1/send-admin-email", {
        method: "OPTIONS",
        headers: {
          "access-control-request-method": "POST",
          "access-control-request-headers":
            "apikey,authorization,content-type,x-client-info,x-econmind-request-id",
        },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "x-econmind-request-id",
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    const fetchImplementation = vi.fn<typeof fetch>(async (input, init) => {
      const browserRequest = new Request(input, init);
      const headers = new Headers(browserRequest.headers);
      headers.set("origin", siteOrigin);
      return handler(new Request(browserRequest, { headers }));
    });
    const client = createClient(upstreamOrigin, publicKey, {
      global: {
        fetch: createSupabaseProxyFetch(
          upstreamOrigin,
          gatewayOrigin,
          fetchImplementation,
        ),
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const result = await client.functions.invoke("send-admin-email", {
      headers: { "X-EconMind-Request-Id": requestId },
      body: { subject: "Local regression test", text: "No email is sent." },
    });
    expect(result.error).not.toBeNull();
    expect(upstreamFetch).toHaveBeenCalledOnce();
    const forwarded = upstreamFetch.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe(
      `${upstreamOrigin}/functions/v1/send-admin-email`,
    );
    expect(forwarded.headers.get("x-econmind-request-id")).toBe(requestId);
    expect(await forwarded.json()).toEqual({
      subject: "Local regression test",
      text: "No email is sent.",
    });
  });

  it("passes caller API key, JWT, body and query only to the configured upstream", async () => {
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ accepted: true }));
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    const response = await handler(
      request(
        "/auth/v1/signup?redirect_to=https%3A%2F%2Feconmind.example&url=https%3A%2F%2Fattacker.example",
        {
          method: "POST",
          headers: {
            authorization: "Bearer user-jwt",
            "content-type": "application/json",
            cookie: "private=value",
            "x-unapproved": "drop",
          },
          body: JSON.stringify({
            email: "person@example.test",
            password: "local-test-password",
          }),
        },
      ),
    );
    expect(response.status).toBe(200);
    const forwarded = upstreamFetch.mock.calls[0][0] as Request;
    expect(new URL(forwarded.url).origin).toBe(upstreamOrigin);
    expect(new URL(forwarded.url).searchParams.get("url")).toBe(
      "https://attacker.example",
    );
    expect(forwarded.headers.get("apikey")).toBe(publicKey);
    expect(forwarded.headers.get("authorization")).toBe("Bearer user-jwt");
    expect(forwarded.headers.has("cookie")).toBe(false);
    expect(forwarded.headers.has("x-unapproved")).toBe(false);
    expect(await forwarded.json()).toEqual({
      email: "person@example.test",
      password: "local-test-password",
    });
    expect(forwarded.redirect).toBe("manual");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      siteOrigin,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("permits only the listed CORS preflight origin, method and headers", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    const allowed = await handler(
      request("/auth/v1/signup", {
        method: "OPTIONS",
        headers: {
          "access-control-request-method": "POST",
          "access-control-request-headers":
            "apikey, authorization, content-type, x-client-info",
        },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(siteOrigin);
    expect(allowed.headers.get("access-control-allow-headers")).toContain(
      "apikey",
    );
    const rejectedPreflightHeaders: Array<Record<string, string>> = [
      {
        origin: "https://attacker.example",
        "access-control-request-method": "POST",
      },
      { "access-control-request-method": "TRACE" },
      {
        "access-control-request-method": "POST",
        "access-control-request-headers": "cookie",
      },
    ];
    for (const headers of rejectedPreflightHeaders) {
      expect(
        (
          await handler(
            request("/auth/v1/signup", { method: "OPTIONS", headers }),
          )
        ).status,
      ).toBe(403);
    }
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it.each([
    "/auth/v1/admin/users",
    "/auth/v1/authorize",
    "/proxy/https://attacker.example",
    "/rest/v1/%2ftable",
    "/rest/v1/table%5cname",
    "/rest/v1/table%2ename",
  ])("rejects nonpublic or encoded routes: %s", async (path) => {
    const upstreamFetch = vi.fn<typeof fetch>();
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    expect((await handler(request(path))).status).toBe(404);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("rejects disallowed origins, unsupported methods and missing API keys before forwarding", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    expect(
      (
        await handler(
          request("/auth/v1/signup", {
            headers: { origin: "https://attacker.example" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handler(request("/auth/v1/signup", { method: "PROPFIND" })))
        .status,
    ).toBe(405);
    expect(
      (
        await handler(
          new Request(`${gatewayOrigin}/auth/v1/signup`, {
            headers: { origin: siteOrigin },
          }),
        )
      ).status,
    ).toBe(401);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it.each([400, 429, 500])(
    "preserves upstream error %s and retry metadata without cookies or caching",
    async (status) => {
      const body = JSON.stringify({
        code: status === 429 ? "over_request_rate_limit" : "upstream_error",
      });
      const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(body, {
          status,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
            "set-cookie": "secret=value",
            "cache-control": "public, max-age=100",
            "access-control-allow-origin": "*",
            "cdn-cache-control": "max-age=100",
          },
        }),
      );
      const handler = createGatewayHandler(
        upstreamOrigin,
        siteOrigin,
        upstreamFetch,
      );
      const response = await handler(request());
      expect(response.status).toBe(status);
      expect(await response.text()).toBe(body);
      expect(response.headers.get("retry-after")).toBe("60");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.has("set-cookie")).toBe(false);
      expect(response.headers.has("cdn-cache-control")).toBe(false);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        siteOrigin,
      );
      expect(upstreamFetch).toHaveBeenCalledOnce();
    },
  );

  it("returns a neutral 503 on an upstream transport failure without retrying", async () => {
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("internal upstream detail"));
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("internal upstream detail");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("does not follow an upstream redirect or expose its destination", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://attacker.example" },
      }),
    );
    const handler = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    const response = await handler(request());
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
    expect((upstreamFetch.mock.calls[0][0] as Request).redirect).toBe("manual");
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("runs real SDK signup and OTP verification through the local transport and gateway", async () => {
    const received: Array<{ path: string; body: unknown; key: string | null }> =
      [];
    const upstreamFetch: typeof fetch = async (input, init) => {
      const forwarded = new Request(input, init);
      const path = new URL(forwarded.url).pathname;
      received.push({
        path,
        body: await forwarded.json(),
        key: forwarded.headers.get("apikey"),
      });
      const user = {
        id: "local-user",
        email: "person@example.test",
        identities: [],
      };
      return Response.json(
        path.endsWith("signup")
          ? user
          : {
              user,
              access_token: "local-access-token",
              refresh_token: "local-refresh-token",
              expires_in: 3600,
              token_type: "bearer",
            },
      );
    };
    const gateway = createGatewayHandler(
      upstreamOrigin,
      siteOrigin,
      upstreamFetch,
    );
    const localFetch: typeof fetch = async (input, init) => {
      const incoming = new Request(input, init);
      const headers = new Headers(incoming.headers);
      headers.set("origin", siteOrigin);
      return gateway(new Request(incoming, { headers }));
    };
    const client = createClient(upstreamOrigin, publicKey, {
      global: {
        fetch: createSupabaseProxyFetch(
          upstreamOrigin,
          gatewayOrigin,
          localFetch,
        ),
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const signup = await client.auth.signUp({
      email: "person@example.test",
      password: "local-test-password",
      options: { emailRedirectTo: `${siteOrigin}/` },
    });
    expect(signup.error).toBeNull();
    expect(signup.data.session).toBeNull();
    const verification = await client.auth.verifyOtp({
      email: "person@example.test",
      token: "12345678",
      type: "email",
    });
    expect(verification.error).toBeNull();
    expect(verification.data.session?.access_token).toBe("local-access-token");
    expect(received).toHaveLength(2);
    expect(received.map((entry) => entry.path)).toEqual([
      "/auth/v1/signup",
      "/auth/v1/verify",
    ]);
    expect(received.every((entry) => entry.key === publicKey)).toBe(true);
    expect(received[0].body).toMatchObject({
      email: "person@example.test",
      password: "local-test-password",
    });
    expect(received[1].body).toMatchObject({
      email: "person@example.test",
      token: "12345678",
      type: "email",
    });
  });
});
