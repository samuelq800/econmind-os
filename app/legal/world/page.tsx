import { PolicyCenter } from "@/components/legal/policy-center";
import { policyMetadata } from "@/lib/legal/documents";
export const metadata = policyMetadata(
  "EconMind World — Official Documents",
  "/legal/world",
  "About EconMind World, World Terms of Use and World Privacy Notice, each within its own stated scope.",
);
export default function WorldLegalPage() {
  return <PolicyCenter world />;
}
