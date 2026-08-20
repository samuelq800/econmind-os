/**
 * GitHub Pages serves this project under a sub-path (`/econmind-os`), while a
 * custom domain or local development serves it at the root. Next.js applies
 * `basePath` to `next/link` and `next/router` automatically, but it does NOT
 * prefix plain public-asset URLs such as `next/image` `src` values or
 * `/league/flags/…` paths. Route every absolute public-asset URL through
 * `withBasePath` so flags (and any future assets) resolve on every host.
 */
const BASE_PATH = (
  process.env.NEXT_PUBLIC_BASE_PATH
  ?? (process.env.GITHUB_PAGES === "true" ? "/econmind-os" : "")
).replace(/\/+$/, "");

export { BASE_PATH };

export function withBasePath(path: string): string {
  if (!BASE_PATH) return path;
  // Leave absolute and protocol-relative URLs untouched.
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) return path;
  return `${BASE_PATH}${path.startsWith("/") ? "" : "/"}${path}`;
}
