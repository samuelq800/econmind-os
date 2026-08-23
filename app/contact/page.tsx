import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/governance/contact-form";

export const metadata: Metadata = { title: "Contact", description: "Send a secure in-site support, privacy, or integrity request to EconMind OS." };

export default function ContactPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-14 sm:px-8 lg:py-20"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[var(--accent)]">Secure support</p><h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-5xl">Contact EconMind OS</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--ink-muted)]">Send a support, privacy, account, League, security, or integrity request from your signed-in account. Platform administrators handle requests in the internal workspace; no separate public email inbox is used.</p><Suspense fallback={null}><ContactForm /></Suspense></main>;
}
