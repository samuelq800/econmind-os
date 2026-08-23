import type { Metadata } from "next";
import { LegalHub } from "@/components/legal/legal-hub";

export const metadata: Metadata = { title: "Community", description: "Community standards, integrity expectations, and support routes for EconMind OS." };

export default function CommunityPage() {
  return <LegalHub eyebrow="EconMind OS community" title="Community" summary="Shared expectations for respectful collaboration, responsible learning, and good-faith participation across schools, teams, and activities." items={[
    { href: "/community-guidelines", label: "Community Guidelines", description: "Read the standards for collaboration, respectful discussion, privacy, and raising a concern." },
    { href: "/integrity", label: "Integrity", description: "Understand the expectations for honest reasoning, attribution, evidence, and official activity records." },
    { href: "/contact", label: "Report or ask for support", description: "Use the signed-in Contact form to report a concern or request a review from platform administrators.", note: "Signed-in account required" },
  ]} />;
}
