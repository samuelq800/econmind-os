import type { Metadata } from "next";
import { BriefDetail } from "@/components/daily-brief/brief-detail";

// GitHub Pages exports the list and archive; individual live briefs are served by
// Vercel/Next when connected to Supabase. The route remains statically valid for
// manually pre-rendered briefs in a future content export.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ briefSlug: "sample" }];
}
export default async function BriefPage({
  params,
}: {
  params: Promise<{ briefSlug: string }>;
}) {
  const { briefSlug } = await params;
  return <BriefDetail slug={briefSlug} />;
}
