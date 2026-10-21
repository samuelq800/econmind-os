import { PolicyCenter } from "@/components/legal/policy-center";
import { policyMetadata } from "@/lib/legal/documents";
export const metadata = policyMetadata(
  "Legal & Policies",
  "/legal",
  "Official policies, rights, responsibilities and participation information for EconMind League and its related services.",
);
export default function LegalPage() {
  return <PolicyCenter />;
}
