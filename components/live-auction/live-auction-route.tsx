"use client";

import { useSearchParams } from "next/navigation";
import { LiveAuctionRoom } from "./live-auction-room";

export function LiveAuctionRoute() {
  const roomId = useSearchParams()?.get("room") ?? "";
  if (!roomId) return <main className="dark grid min-h-screen place-items-center bg-[#07120f] px-5 text-[#edf5f1]"><p className="max-w-md text-center text-sm leading-6 text-[#a7bbb1]">This Live Auction link is incomplete. Ask the event administrator for the full room link.</p></main>;
  return <LiveAuctionRoom roomId={roomId} />;
}
