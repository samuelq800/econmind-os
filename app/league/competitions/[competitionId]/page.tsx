import { redirect } from "next/navigation";

// Static GitHub Pages cannot emit a page for every database UUID. Live rooms
// use the compatible query route: /league/competitions/room?competition=<id>.
export function generateStaticParams() { return [{ competitionId: "preview" }]; }
export default function CompetitionDynamicCompatibilityPage() { redirect("/league/competitions/room"); }
