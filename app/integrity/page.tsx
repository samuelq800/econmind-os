import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { INTEGRITY_SECTIONS } from "@/lib/legal/legal-content";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal/legal-config";

export const metadata: Metadata = { title: "Integrity", description: "Academic and challenge integrity expectations for EconMind OS." };

export default function IntegrityPage() {
  return <LegalPage eyebrow="EconMind OS standards" title="Integrity" summary="A clear standard for honest reasoning, evidence, collaboration, and official challenge work." version="1.0" effectiveDate={LEGAL_EFFECTIVE_DATE} sections={INTEGRITY_SECTIONS} />;
}
