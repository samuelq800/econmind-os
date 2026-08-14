import type { Metadata } from "next";
import { ViewerInvitationEntry } from "@/components/auth/viewer-invitation-entry";

export const metadata: Metadata = {
  title: "View-only invitation | EconMind OS",
  description: "Enter EconMind OS with a read-only invitation code.",
};

export default function ViewerInvitationPage() {
  return <ViewerInvitationEntry />;
}
