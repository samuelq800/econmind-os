import type { Metadata } from "next";
import { CollaborationNetwork } from "@/components/collaboration/collaboration-network";

export const metadata: Metadata = {
  title: "Collaboration Network",
  description: "EconMind connects student-led communities across economics, humanities, critical thinking and interdisciplinary learning.",
};

export default function CollaborationPage() {
  return <CollaborationNetwork />;
}
