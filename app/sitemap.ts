import type { MetadataRoute } from "next";
import { ECONOMIC_CASES } from "@/lib/cases/definitions";
import { canonicalPageUrl, INDEXABLE_STATIC_ROUTES } from "@/lib/seo/routes";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = INDEXABLE_STATIC_ROUTES.map(
    (path) => ({ url: canonicalPageUrl(path) }),
  );
  const caseEntries: MetadataRoute.Sitemap = ECONOMIC_CASES.filter(
    (economicCase) => economicCase.status === "published",
  ).map((economicCase) => ({
    url: canonicalPageUrl(`/cases/${encodeURIComponent(economicCase.slug)}`),
  }));

  return [...staticEntries, ...caseEntries];
}
