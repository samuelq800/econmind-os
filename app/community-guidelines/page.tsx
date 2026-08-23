import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { COMMUNITY_SECTIONS } from "@/lib/legal/legal-content";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal/legal-config";

export const metadata: Metadata = { title: "Community Guidelines", description: "How EconMind OS keeps a respectful, safe learning community." };

export default function CommunityGuidelinesPage() {
  return <LegalPage eyebrow="EconMind OS community" title="Community Guidelines" summary="How we collaborate, share work, and raise concerns across schools and teams." version="1.0" effectiveDate={LEGAL_EFFECTIVE_DATE} sections={COMMUNITY_SECTIONS} />;
}
