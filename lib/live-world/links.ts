import { withBasePath } from "@/lib/base-path";

export function liveWorldRoomPath(roomId: string) {
  return `/live-world/?room=${encodeURIComponent(roomId)}`;
}

export function liveWorldRoomUrl(origin: string, roomId: string) {
  return new URL(withBasePath(liveWorldRoomPath(roomId)), origin).toString();
}
