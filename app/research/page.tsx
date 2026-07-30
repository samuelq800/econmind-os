import { FeatureUnavailable } from "@/components/platform/feature-unavailable";

export default function ResearchPage() {
  return <FeatureUnavailable area="Learning & research" title="Curated research is being prepared." description="Evidence Lab will provide curated demonstrations, model evidence and econometric explanations. Data upload is intentionally unavailable in this release." availableNow={[{ href: "/daily-brief", label: "Read Daily Brief" }, { href: "/cases", label: "Explore Cases" }]} />;
}
