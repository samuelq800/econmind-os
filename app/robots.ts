import type { MetadataRoute } from "next";
import { canonicalUrl, NON_PUBLIC_ROUTE_PREFIXES } from "@/lib/seo/routes";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...NON_PUBLIC_ROUTE_PREFIXES],
    },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
