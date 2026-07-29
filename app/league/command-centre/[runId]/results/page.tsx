import { redirect } from "next/navigation";

export function generateStaticParams() { return [{ runId: "preview" }]; }
export default function CommandCentreResultDynamicCompatibilityPage() { redirect("/league/command-centre/run/results"); }
