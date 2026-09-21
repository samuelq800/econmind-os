import { BASE_PATH } from "@/lib/base-path";

/** The return URL is built only from the current site's origin and build-time base path. */
export function googleSignInRedirectUrl(origin: string, basePath = BASE_PATH) {
  const site = new URL(origin);
  if ((site.protocol !== "https:" && site.protocol !== "http:") || site.origin !== origin) {
    throw new Error("The current site URL cannot be used for Google sign-in.");
  }
  const redirect = new URL(`${basePath}/`, site.origin);
  redirect.searchParams.set("auth", "google");
  return redirect.toString();
}

function usableText(value: unknown, limit: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, limit) || null;
}

export function profileMetadataFallback(metadata: Record<string, unknown> | null | undefined) {
  const displayName = usableText(metadata?.display_name, 80)
    ?? usableText(metadata?.full_name, 80)
    ?? usableText(metadata?.name, 80);
  const candidate = usableText(metadata?.avatar_url, 2048);
  let avatarUrl: string | null = null;
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && url.toString().length <= 2048) avatarUrl = url.toString();
    } catch { /* Ignore unusable provider metadata. */ }
  }
  return { displayName, avatarUrl };
}

export function missingProfileMetadata(
  profile: { display_name: string | null; avatar_url: string | null },
  metadata: Record<string, unknown> | null | undefined,
) {
  const fallback = profileMetadataFallback(metadata);
  return {
    displayName: profile.display_name?.trim() ? null : fallback.displayName,
    avatarUrl: profile.avatar_url?.trim() ? null : fallback.avatarUrl,
  };
}
