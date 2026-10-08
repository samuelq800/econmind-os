import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "../lib/visible-polling";

describe("visible page fallback polling", () => {
  let page: EventTarget & { visibilityState: string };
  let browser: EventTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { visibilityState: "visible" });
    browser = Object.assign(new EventTarget(), {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    vi.stubGlobal("document", page);
    vi.stubGlobal("window", browser);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([10_000, 20_000])(
    "preserves the existing %i ms foreground cadence",
    (cadence) => {
      const read = vi.fn();
      const stop = startVisiblePolling(read, cadence);
      expect(read).not.toHaveBeenCalled(); // The component still owns its initial read.
      vi.advanceTimersByTime(cadence - 1);
      expect(read).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(read).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(cadence);
      expect(read).toHaveBeenCalledTimes(2);
      stop();
    },
  );

  it("skips hidden reads, catches up immediately on return, then keeps polling", () => {
    const read = vi.fn();
    const stop = startVisiblePolling(read, 10_000);
    page.visibilityState = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    browser.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(3_600_000);
    expect(read).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });

  it("rechecks after network recovery without waiting for the next poll", () => {
    const read = vi.fn();
    const stop = startVisiblePolling(read, 20_000);
    browser.dispatchEvent(new Event("online"));
    expect(read).toHaveBeenCalledTimes(1);
    stop();
  });

  it("removes timers and catch-up listeners when the component unmounts", () => {
    const read = vi.fn();
    const stop = startVisiblePolling(read, 10_000);
    stop();
    stop();
    page.dispatchEvent(new Event("visibilitychange"));
    browser.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(60_000);
    expect(read).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
