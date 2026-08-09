import type { Metadata } from "next";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { AccountOnboarding } from "@/components/auth/account-onboarding";
import { AuthProvider } from "@/components/auth/auth-provider";
import { RegisteredAppGate } from "@/components/auth/registered-app-gate";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EconMind OS", template: "%s · EconMind OS" },
  description: "An interactive economics laboratory for models, policy simulation, evidence and cross-school economic experimentation.",
  metadataBase: new URL("https://samuelq800.github.io/econmind-os/"),
  openGraph: {
    title: "EconMind OS",
    description: "From the real world to economic reasoning.",
    images: [{ url: "https://samuelq800.github.io/econmind-os/og.png", width: 1920, height: 1080, alt: "EconMind OS economic reasoning diagram" }],
  },
  twitter: { card: "summary_large_image", title: "EconMind OS", description: "From the real world to economic reasoning.", images: ["https://samuelq800.github.io/econmind-os/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><AuthProvider><RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate><AuthDialog /><AccountOnboarding /></AuthProvider></ThemeProvider></body></html>;
}
