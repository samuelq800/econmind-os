"use client";

import { usePathname } from "next/navigation";
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

function isStandaloneLiveWorld(pathname: string) {
  return pathname === "/live-world" || pathname.startsWith("/live-world/");
}

export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // A Live World invitation opens a room-only application boundary. It does
  // not initialise, read, or link the visitor's EconMind account session.
  if (isStandaloneLiveWorld(pathname)) return <>{children}</>;

  return <ThemeProvider><PwaRegistration /><AuthProvider><AccountDeletionProvider><RegisteredAppGate><Navbar />{children}<Footer /></RegisteredAppGate><AuthDialog /><AccountOnboarding /><LegalConsentGate /></AccountDeletionProvider></AuthProvider></ThemeProvider>;
}
