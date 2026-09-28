export type Season1NotificationPermission = NotificationPermission | "unsupported";

export function getSeason1NotificationPermission(): Season1NotificationPermission {
  if (typeof window === "undefined" || !window.isSecureContext || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestSeason1NotificationPermission(): Promise<Season1NotificationPermission> {
  const current = getSeason1NotificationPermission();
  if (current !== "default") return current;
  try {
    // This must be called synchronously from a click handler, before other async work.
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}
