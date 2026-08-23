import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS_SECTIONS } from "@/lib/legal/legal-content";
import { LEGAL_DOCUMENTS } from "@/lib/legal/legal-config";

export const metadata: Metadata = { title: "Terms of Use", description: "The terms for using EconMind OS learning and community features." };

export default function TermsPage() {
  return <LegalPage eyebrow="EconMind OS legal" title="Terms of Use" summary="The shared expectations for using EconMind OS as an educational learning platform." version={LEGAL_DOCUMENTS.terms.version} effectiveDate={LEGAL_DOCUMENTS.terms.effectiveDate} sections={TERMS_SECTIONS} />;
}
