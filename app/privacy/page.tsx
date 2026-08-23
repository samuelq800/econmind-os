import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PRIVACY_SECTIONS } from "@/lib/legal/legal-content";
import { LEGAL_DOCUMENTS } from "@/lib/legal/legal-config";

export const metadata: Metadata = { title: "Privacy Notice", description: "How EconMind OS handles account, learning, and community information." };

export default function PrivacyPage() {
  return <LegalPage eyebrow="EconMind OS legal" title="Privacy Notice" summary="A factual guide to the information EconMind OS handles, why it is used, and the controls available to you." version={LEGAL_DOCUMENTS.privacy.version} effectiveDate={LEGAL_DOCUMENTS.privacy.effectiveDate} sections={PRIVACY_SECTIONS} />;
}
