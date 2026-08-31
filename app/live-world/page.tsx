import { Suspense } from "react";
import { LiveWorldRoute } from "@/components/live-world/live-world-route";

export default function LiveWorldPage() {
  return <Suspense fallback={null}><LiveWorldRoute /></Suspense>;
}
