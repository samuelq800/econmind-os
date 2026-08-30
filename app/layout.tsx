import type { Metadata, Viewport } from "next";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { AccountOnboarding } from "@/components/auth/account-onboarding";
import { AuthProvider } from "@/components/auth/auth-provider";
import { RegisteredAppGate } from "@/components/auth/registered-app-gate";
import { AccountDeletionProvider } from "@/components/governance/account-deletion-provider";
import { LegalConsentGate } from "@/components/legal/legal-consent-gate";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { PwaRegistration } from "@/components/pwa/pwa-registration";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://econmind.group",
);
const badgePaths = {
  icon48: withBasePath("/brand/econmind-badge-48.png"),
  icon192: withBasePath("/brand/econmind-badge-192.png"),
  icon512: withBasePath("/brand/econmind-badge-512.png"),
  apple: withBasePath("/brand/econmind-badge-180.png"),
  social: withBasePath("/brand/econmind-badge-social.png"),
};
const socialImageUrl = new URL(badgePaths.social, siteUrl).toString();

export const metadata: Metadata = {
  title: { default: "EconMind OS", template: "%s · EconMind OS" },
  description: "An interactive economics laboratory for models, policy simulation, evidence and cross-school economic experimentation.",
  applicationName: "EconMind OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EconMind OS",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false, url: false },
  metadataBase: siteUrl,
  manifest: withBasePath("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: badgePaths.icon48, sizes: "48x48", type: "image/png" },
      { url: badgePaths.icon192, sizes: "192x192", type: "image/png" },
      { url: badgePaths.icon512, sizes: "512x512", type: "image/png" },
    ],
    shortcut: badgePaths.icon48,
    apple: [{ url: badgePaths.apple, sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "EconMind OS",
    description: "From the real world to economic reasoning.",
    images: [{ url: socialImageUrl, width: 1200, height: 630, alt: "EconMind official badge" }],
  },
  twitter: { card: "summary_large_image", title: "EconMind OS", description: "From the real world to economic reasoning.", images: [socialImageUrl] },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1814" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><PwaRegistration /><AuthProvider><AccountDeletionProvider><RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate><AuthDialog /><AccountOnboarding /><LegalConsentGate /></AccountDeletionProvider></AuthProvider></ThemeProvider></body></html>;
}
