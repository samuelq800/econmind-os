import type { Metadata } from "next";
import { TeamPage } from "@/components/team/team-page";

export const metadata: Metadata = {
  title: { absolute: "Team · EconMind OS" },
  description: "Meet the student founders and regional leadership team behind EconMind OS.",
};

export default function TeamRoute() {
  return <TeamPage />;
}
