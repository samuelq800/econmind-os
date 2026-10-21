import { LegacyPolicyRedirect } from "@/components/legal/legacy-policy-redirect";
import { policyMetadata } from "@/lib/legal/documents";
export const metadata = { ...policyMetadata("Privacy Notice", "/legal/privacy", "The current official policy is available in the Legal Center."), robots: { index: false, follow: true } };
export default function LegacyPage() { return <LegacyPolicyRedirect document="privacy" destination="/legal/privacy/" />; }
