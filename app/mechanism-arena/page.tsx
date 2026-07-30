import { FeatureUnavailable } from "@/components/platform/feature-unavailable";

export default function MechanismArenaPage() {
  return <FeatureUnavailable area="Learning & research" title="Mechanism Arena is being prepared." description="The Arena will open only with complete preset experiments, structured rule changes, working outcomes and reflection—not an empty generic simulator." availableNow={[{ href: "/models/prisoners-dilemma", label: "Study strategic interaction" }, { href: "/cases", label: "Explore Cases" }]} />;
}
