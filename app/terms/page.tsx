import { LegacyPolicyRedirect } from "@/components/legal/legacy-policy-redirect";
import { policyMetadata } from "@/lib/legal/documents";
export const metadata = { ...policyMetadata("Terms of Use", "/legal/terms", "The current official policy is available in the Legal Center."), robots: { index: false, follow: true } };
export default function LegacyPage() { return <LegacyPolicyRedirect document="terms" destination="/legal/terms/" />; }
