import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSeason1NotificationPermission,
  requestSeason1NotificationPermission,
} from "../lib/season1/notification-permission";

afterEach(() => vi.unstubAllGlobals());

describe("Season 1 notification permission", () => {
  it("does not ask on unsupported or insecure origins", async () => {
    expect(getSeason1NotificationPermission()).toBe("unsupported");
    expect(await requestSeason1NotificationPermission()).toBe("unsupported");
    vi.stubGlobal("window", { isSecureContext: false, Notification: {} });
    expect(await requestSeason1NotificationPermission()).toBe("unsupported");
  });

  it("requests once from a user gesture when permission is undecided", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const notification = { permission: "default", requestPermission };
    vi.stubGlobal("window", { isSecureContext: true, Notification: notification });
    vi.stubGlobal("Notification", notification);
    expect(await requestSeason1NotificationPermission()).toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("does not re-prompt after a decision", async () => {
    const requestPermission = vi.fn();
    const notification = { permission: "denied", requestPermission };
    vi.stubGlobal("window", { isSecureContext: true, Notification: notification });
    vi.stubGlobal("Notification", notification);
    expect(await requestSeason1NotificationPermission()).toBe("denied");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("treats a failed browser prompt as unavailable without blocking entry", async () => {
    const notification = { permission: "default", requestPermission: vi.fn().mockRejectedValue(Error("blocked")) };
    vi.stubGlobal("window", { isSecureContext: true, Notification: notification });
    vi.stubGlobal("Notification", notification);
    expect(await requestSeason1NotificationPermission()).toBe("unsupported");
  });
});
