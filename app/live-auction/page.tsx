import { Suspense } from "react";
import { LiveAuctionRoute } from "@/components/live-auction/live-auction-route";
export default function LiveAuctionPage() { return <Suspense fallback={null}><LiveAuctionRoute /></Suspense>; }
