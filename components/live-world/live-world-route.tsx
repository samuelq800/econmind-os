"use client";

import { useSearchParams } from "next/navigation";
import { LiveWorldRoom } from "./live-world-room";

export function LiveWorldRoute() {
  const roomId = useSearchParams()?.get("room") ?? "";
  if (!roomId) return <main className="grid min-h-screen place-items-center bg-[#07120f] px-5 text-[#edf5f1]"><p className="max-w-md text-center text-sm leading-6 text-[#a7bbb1]">This Live World link is incomplete. Ask the event administrator for the full room link.</p></main>;
  return <LiveWorldRoom roomId={roomId} />;
}
