/** Presentation only: never used to grant access or change data. */
export function visualScene(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return "showcase";
  if (path.startsWith("/season1")) return "season";
  if (path === "/profile" || path === "/dev/visual-pilot/profile") return "identity";
  if (["/privacy", "/terms", "/legal", "/integrity", "/community-guidelines"].includes(path) || path.startsWith("/daily-brief/") || path === "/learn/research/paper") return "reading";
  if (["/about", "/contact", "/community", "/collaboration", "/explore", "/activities", "/models", "/cases", "/simulation", "/league", "/league/about", "/learn/research"].includes(path)) return "showroom";
  return "workspace";
}
