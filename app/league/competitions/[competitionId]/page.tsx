import { redirect } from "next/navigation";

export function generateStaticParams() { return [{ competitionId: "preview" }]; }
export default function CompetitionDynamicCompatibilityPage() { redirect("/league/world"); }
