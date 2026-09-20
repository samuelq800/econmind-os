import { withBasePath } from "@/lib/base-path";

export function liveAuctionRoomPath(roomId: string) {
  return `/live-auction/?room=${encodeURIComponent(roomId)}`;
}

export function liveAuctionRoomUrl(origin: string, roomId: string) {
  return new URL(withBasePath(liveAuctionRoomPath(roomId)), origin).toString();
}
