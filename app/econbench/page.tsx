import { FeatureUnavailable } from "@/components/platform/feature-unavailable";

export default function EconBenchPage() {
  return <FeatureUnavailable area="Learning & research" title="EconBench is being authored." description="EconBench will launch with ten complete, preset multi-model reasoning challenges. It will remain separate from Model Practice, Sandbox, Mechanism Arena and World Economy." availableNow={[{ href: "/models", label: "Open Models" }, { href: "/cases", label: "Explore Cases" }]} />;
}
