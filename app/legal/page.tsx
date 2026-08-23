import type { Metadata } from "next";
import { LegalHub } from "@/components/legal/legal-hub";

export const metadata: Metadata = { title: "Legal", description: "Privacy, terms, and account-support information for EconMind OS." };

export default function LegalPage() {
  return <LegalHub eyebrow="EconMind OS legal" title="Legal" summary="The documents that explain how EconMind OS is used, how account and learning information is handled, and how to request help." items={[
    { href: "/terms", label: "Terms of Use", description: "The rules for using EconMind OS learning tools, school and team features, challenges, and shared work." },
    { href: "/privacy", label: "Privacy Notice", description: "What information the platform handles, why it is used, visibility controls, and account requests." },
    { href: "/contact", label: "Privacy or account request", description: "Use the signed-in Contact form for data access, correction, deletion, privacy, or security requests.", note: "Signed-in account required" },
  ]} />;
}
