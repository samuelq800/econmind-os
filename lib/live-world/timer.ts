import type { LiveWorldRoomView } from "./types";

type LiveWorldRoomTimer = LiveWorldRoomView["room"];

export function reportedLiveWorldDeadline(room: LiveWorldRoomTimer, now = Date.now()) {
  if (room.status !== "live") return null;
  const exactDeadline = room.timerEndsAt ? Date.parse(room.timerEndsAt) : Number.NaN;
  return Number.isFinite(exactDeadline)
    ? exactDeadline
    : now + Math.max(0, room.remainingSeconds ?? room.durationSeconds) * 1000;
}

export function reconcileLiveWorldDeadline(
  room: LiveWorldRoomTimer,
  currentDeadline: number | null,
  currentStartedAt: string | null,
  now = Date.now(),
) {
  const reportedDeadline = reportedLiveWorldDeadline(room, now);
  if (reportedDeadline === null) return null;
  if (currentDeadline === null || currentStartedAt !== room.startedAt) return reportedDeadline;
  // Realtime/poll responses may arrive on opposite sides of a second boundary.
  // A snapshot from the same run may correct the clock forwards, never backwards.
  return Math.min(currentDeadline, reportedDeadline);
}

export function secondsUntilLiveWorldDeadline(deadline: number | null, fallback: number, now = Date.now()) {
  if (deadline === null) return Math.max(0, fallback);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
