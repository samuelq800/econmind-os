"use client";

import { useCallback, useEffect, useRef } from "react";
import { createRoomRefreshController, type RoomRealtimeStatus } from "./refresh-controller";

type Options<View, Channel> = {
  fetch: (roomId: string) => Promise<View>;
  onView: (view: View) => void;
  onError: (error: unknown) => void;
  terminal: (view: View) => boolean;
  subscribe: (roomId: string, change: () => void, status: (status: RoomRealtimeStatus) => void, disposed: () => boolean) => Promise<Channel | null>;
  unsubscribe: (channel: Channel) => Promise<unknown>;
};

export function useRoomRefresh<View, Channel>(roomId: string, options: Options<View, Channel>) {
  const latest = useRef(options);
  const controller = useRef<ReturnType<typeof createRoomRefreshController<View, Channel>> | null>(null);
  useEffect(() => { latest.current = options; });
  useEffect(() => {
    const current = createRoomRefreshController<View, Channel>({
      fetch: () => latest.current.fetch(roomId),
      onView: (view) => latest.current.onView(view),
      onError: (error) => latest.current.onError(error),
      terminal: (view) => latest.current.terminal(view),
      subscribe: (change, status, disposed) => latest.current.subscribe(roomId, change, status, disposed),
      unsubscribe: (channel) => latest.current.unsubscribe(channel),
      visible: () => document.visibilityState === "visible",
      listenVisibility: (callback) => {
        document.addEventListener("visibilitychange", callback);
        return () => document.removeEventListener("visibilitychange", callback);
      },
    });
    controller.current = current;
    current.start();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = null;
    };
  }, [roomId]);
  return useCallback(() => controller.current?.refresh() ?? Promise.resolve(), []);
}
