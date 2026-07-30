import { redirect } from "next/navigation";

/** Legacy quarter-based routes now lead to the persistent World experience. */
export default function CompetitionsPage() { redirect("/league/world"); }
