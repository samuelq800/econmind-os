const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const requestHeaders = [
  "accept",
  "accept-profile",
  "apikey",
  "authorization",
  "content-type",
  "content-profile",
  "prefer",
  "range",
  "range-unit",
  "x-client-info",
  "x-econmind-request-id",
  "x-supabase-api-version",
  "x-upsert",
  "x-region",
];
const publicAuthPath =
  /^\/auth\/v1\/(health|settings|signup|token|verify|resend|recover|logout|user|reauthenticate)$/;

function allowedPath(path: string) {
  return (
    publicAuthPath.test(path) || /^\/(rest|functions|storage)\/v1\//.test(path)
  );
}

/** A fixed-upstream transport. Supabase still validates the caller's key/JWT
 * and RLS; this gateway has no database credentials, sessions, cache or logs.
 */
export function createGatewayHandler(
  upstreamUrl: string,
  siteOrigin: string,
  upstreamFetch: typeof fetch = (...args) => fetch(...args),
) {
  const upstream = new URL(upstreamUrl);
  if (
    upstream.protocol !== "https:" ||
    upstream.pathname !== "/" ||
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash
  ) {
    throw new Error("Gateway upstream must be an HTTPS origin.");
  }

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
    });
    if (origin === siteOrigin) {
      responseHeaders.set("Access-Control-Allow-Origin", siteOrigin);
      responseHeaders.set(
        "Access-Control-Expose-Headers",
        "content-range, range-unit, retry-after, x-supabase-api-version",
      );
    }
    const fail = (status: number, message: string) =>
      Response.json({ message }, { status, headers: responseHeaders });
    if (origin && origin !== siteOrigin)
      return fail(403, "Origin not allowed.");
    // Reject encoded separators/dot segments before fixed-upstream forwarding.
    if (!allowedPath(url.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) {
      return fail(404, "Route not available.");
    }
    if (request.method === "OPTIONS") {
      const method = request.headers.get("access-control-request-method") ?? "";
      const headers = (
        request.headers.get("access-control-request-headers") ?? ""
      )
        .toLowerCase()
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (
        origin !== siteOrigin ||
        !methods.has(method) ||
        headers.some((header) => !requestHeaders.includes(header))
      ) {
        return fail(403, "Preflight not allowed.");
      }
      responseHeaders.set(
        "Access-Control-Allow-Methods",
        [...methods].join(", "),
      );
      responseHeaders.set(
        "Access-Control-Allow-Headers",
        requestHeaders.join(", "),
      );
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    if (!methods.has(request.method)) return fail(405, "Method not allowed.");
    if (!request.headers.has("apikey")) return fail(401, "API key required.");

    const target = new URL(upstream.origin);
    target.pathname = url.pathname;
    target.search = url.search;
    const headers = new Headers();
    for (const name of requestHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    try {
      const forwarded = new Request(target, request);
      const response = await upstreamFetch(
        new Request(forwarded, {
          headers,
          redirect: "manual",
          cache: "no-store",
        }),
      );
      // Never follow redirects carrying the caller's Authorization or API key.
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.status !== 304
      ) {
        return fail(502, "Unexpected upstream redirect.");
      }
      const resultHeaders = new Headers(response.headers);
      for (const name of [...resultHeaders.keys()]) {
        if (
          name.startsWith("access-control-") ||
          name === "set-cookie" ||
          name === "cdn-cache-control" ||
          name === "cloudflare-cdn-cache-control"
        ) {
          resultHeaders.delete(name);
        }
      }
      responseHeaders.forEach((value, name) => resultHeaders.set(name, value));
      return new Response(response.body, {
        status: response.status,
        headers: resultHeaders,
      });
    } catch {
      return fail(
        503,
        "Authentication and data service temporarily unavailable.",
      );
    }
  };
}
