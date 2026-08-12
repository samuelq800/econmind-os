import { redirect } from "next/navigation";

/** Legacy world address now opens the dedicated Simulation system. */
export default function WorldPage() { redirect("/simulation/world"); }
