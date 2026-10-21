import { LegacyPolicyRedirect } from "@/components/legal/legacy-policy-redirect";
import { policyMetadata } from "@/lib/legal/documents";
export const metadata = { ...policyMetadata("Academic and Research Integrity", "/legal/integrity", "The current official policy is available in the Legal Center."), robots: { index: false, follow: true } };
export default function LegacyPage() { return <LegacyPolicyRedirect document="integrity" destination="/legal/integrity/" />; }
