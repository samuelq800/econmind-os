import type { Metadata } from "next";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { AccountOnboarding } from "@/components/auth/account-onboarding";
import { AuthProvider } from "@/components/auth/auth-provider";
import { RegisteredAppGate } from "@/components/auth/registered-app-gate";
import { AccountDeletionProvider } from "@/components/governance/account-deletion-provider";
import { LegalConsentGate } from "@/components/legal/legal-consent-gate";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://econmind.group",
);
const socialImageUrl = new URL("og.png", siteUrl).toString();

export const metadata: Metadata = {
  title: { default: "EconMind OS", template: "%s · EconMind OS" },
  description: "An interactive economics laboratory for models, policy simulation, evidence and cross-school economic experimentation.",
  metadataBase: siteUrl,
  openGraph: {
    title: "EconMind OS",
    description: "From the real world to economic reasoning.",
    images: [{ url: socialImageUrl, width: 1920, height: 1080, alt: "EconMind OS economic reasoning diagram" }],
  },
  twitter: { card: "summary_large_image", title: "EconMind OS", description: "From the real world to economic reasoning.", images: [socialImageUrl] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><AuthProvider><AccountDeletionProvider><RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate><AuthDialog /><AccountOnboarding /><LegalConsentGate /></AccountDeletionProvider></AuthProvider></ThemeProvider></body></html>;
}
