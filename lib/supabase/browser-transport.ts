/** Keep the SDK's original project URL, session keys and OAuth redirects. Only
 * HTTP transport uses the optional first-party gateway; writes are never replayed.
 */
export function createSupabaseProxyFetch(
  supabaseUrl: string,
  proxyUrl: string,
  fetchImplementation: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  const upstream = new URL(supabaseUrl);
  const proxy = new URL(proxyUrl);
  if (
    proxy.protocol !== "https:" ||
    proxy.username ||
    proxy.password ||
    proxy.search ||
    proxy.hash ||
    proxy.pathname !== "/"
  ) {
    throw new Error("Supabase proxy must be an HTTPS origin.");
  }

  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== upstream.origin) return fetchImplementation(input, init);
    url.protocol = proxy.protocol;
    url.host = proxy.host;
    if (!(input instanceof Request)) {
      // SDK requests carry string/Blob bodies. Preserve their body source;
      // converting it to ReadableStream requires unsupported streaming uploads
      // in some mobile browsers and in-app WebViews.
      return fetchImplementation(
        new Request(url, { ...init, credentials: "omit" }),
      );
    }
    const request = new Request(input, init);
    return fetchImplementation(
      new Request(url, {
        method: request.method,
        headers: request.headers,
        body: request.body ? await request.blob() : undefined,
        signal: request.signal,
        mode: request.mode,
        redirect: request.redirect,
        cache: request.cache,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        integrity: request.integrity,
        keepalive: request.keepalive,
        credentials: "omit",
      }),
    );
  };
}

export function supabaseBrowserTransportOptions() {
  const proxyUrl = process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return proxyUrl && supabaseUrl
    ? { global: { fetch: createSupabaseProxyFetch(supabaseUrl, proxyUrl) } }
    : {};
}
