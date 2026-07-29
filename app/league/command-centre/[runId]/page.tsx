import { redirect } from "next/navigation";

// GitHub Pages is statically exported, so live UUID records use ?run=<uuid>.
// The template route remains available for route compatibility and documentation.
export function generateStaticParams() { return [{ runId: "preview" }]; }
export default function CommandCentreDynamicCompatibilityPage() { redirect("/league/command-centre/run"); }
