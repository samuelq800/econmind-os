import type { Metadata } from "next";
import { GovernanceAdmin } from "@/components/governance/governance-admin";

export const metadata: Metadata = { title: "Governance requests" };

export default function GovernanceAdminPage() {
  return <GovernanceAdmin />;
}
