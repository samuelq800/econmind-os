import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/governance/contact-form";
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_CONTACT_MAILTO } from "@/lib/platform/contact";

export const metadata: Metadata = { title: "Contact", description: "Send a secure in-site support, privacy, or integrity request to EconMind OS." };

export default function ContactPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-14 sm:px-8 lg:py-20"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">Secure support</p><h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-5xl">Contact EconMind OS</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--ink-muted)]">Send a support, privacy, account, League, security, or integrity request from your signed-in account. Platform administrators handle requests in the internal workspace, so the in-site form is the best route for requests that need an auditable response.</p><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">For general enquiries or if you cannot sign in, email <a href={OFFICIAL_CONTACT_MAILTO} className="font-bold text-[var(--accent)] hover:underline">{OFFICIAL_CONTACT_EMAIL}</a>. Do not send passwords, one-time codes, or other unnecessary sensitive information by email.</p><Suspense fallback={null}><ContactForm /></Suspense></main>;
}
