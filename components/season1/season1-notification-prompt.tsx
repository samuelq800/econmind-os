"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getSeason1NotificationPermission,
  requestSeason1NotificationPermission,
  type Season1NotificationPermission,
} from "@/lib/season1/notification-permission";

export function Season1NotificationPrompt() {
  const [permission, setPermission] = useState<Season1NotificationPermission | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPermission(getSeason1NotificationPermission()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (permission === null) return null;

  return (
    <aside className="season1-notification-prompt" aria-label="Season 1 browser notifications">
      <BellRing size={19} aria-hidden="true" />
      <div>
        <strong>Season 1 notifications</strong>
        <p>
          {permission === "unsupported"
            ? "This browser or browsing mode cannot request notifications here. Season 1 remains available."
            : permission === "granted"
            ? "Browser permission is on. Season 1 alerts will become available when push delivery launches."
            : permission === "denied"
              ? "Notifications are blocked. You can change this in your browser's site settings."
              : "Allow browser notifications so you can receive Season 1 updates when alerts launch."}
        </p>
      </div>
      {permission === "default" && (
        <button type="button" onClick={() => void requestSeason1NotificationPermission().then(setPermission)}>
          Allow notifications
        </button>
      )}
    </aside>
  );
}
