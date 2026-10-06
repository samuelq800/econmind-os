import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoomRefreshController, type RoomRealtimeStatus } from "@/lib/live-room/refresh-controller";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function harness() {
  let visible = true;
  let visibility = () => {};
  let change = () => {};
  let status = (value: RoomRealtimeStatus) => { void value; };
  const fetch = vi.fn(async () => ({ status: "LIVE" }));
  const unsubscribe = vi.fn(async (channel: string) => { void channel; });
  const subscribe = vi.fn(async (onChange: () => void, onStatus: (value: RoomRealtimeStatus) => void, disposed: () => boolean): Promise<string | null> => {
    if (disposed()) return null;
    change = onChange; status = onStatus; return "channel";
  });
  const onView = vi.fn();
  const onError = vi.fn();
  const removeVisibility = vi.fn();
  const controller = createRoomRefreshController({
    fetch, subscribe, unsubscribe, onView, onError,
    terminal: (view) => ["CLOSED", "FINALIZED"].includes(view.status),
    visible: () => visible,
    listenVisibility: (callback) => { visibility = callback; return removeVisibility; },
  });
  return { controller, fetch, subscribe, unsubscribe, onView, onError, removeVisibility,
    change: () => change(), status: (value: RoomRealtimeStatus) => status(value),
    visibility: (value: boolean) => { visible = value; visibility(); },
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("room refresh lifecycle", () => {
  it("fetches once on entry and keeps one subscription across replacement view objects", async () => {
    const h = harness(); h.controller.start(); await flush();
    expect(h.fetch).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 4; i++) await h.controller.refresh();
    expect(h.onView.mock.calls[0][0]).not.toBe(h.onView.mock.calls[1][0]);
    expect(h.subscribe).toHaveBeenCalledTimes(1);
    expect(h.unsubscribe).not.toHaveBeenCalled();
    h.controller.dispose(); expect(h.unsubscribe).toHaveBeenCalledExactlyOnceWith("channel");
  });

  it("cleans up a late async channel and ignores late callbacks", async () => {
    const h = harness(); const pending = deferred<string>();
    h.subscribe.mockImplementationOnce(async () => pending.promise);
    h.controller.start(); await flush();
    const disposed = h.subscribe.mock.calls[0][2];
    h.controller.dispose(); expect(disposed()).toBe(true);
    pending.resolve("late-channel"); await flush();
    expect(h.unsubscribe).toHaveBeenCalledExactlyOnceWith("late-channel");
    h.change(); h.status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(60000);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.removeVisibility).toHaveBeenCalledTimes(1);
  });

  it("allows at most one RPC in flight and one trailing refresh for concurrent sources", async () => {
    const h = harness(); h.controller.start(); await flush(); h.status("SUBSCRIBED");
    const first = deferred<{ status: string }>(); const second = deferred<{ status: string }>();
    let active = 0; let peak = 0;
    const tracked = async (pending: typeof first) => { active++; peak = Math.max(peak, active); const value = await pending.promise; active--; return value; };
    h.fetch.mockImplementationOnce(() => tracked(first)).mockImplementationOnce(() => tracked(second));
    // Poll starts the request; Realtime and post-mutation refreshes join it.
    await vi.advanceTimersByTimeAsync(15000);
    h.change(); const request = h.controller.refresh();
    expect(h.controller.refresh()).toBe(request);
    expect(h.fetch).toHaveBeenCalledTimes(2);
    first.resolve({ status: "LIVE" }); await flush();
    h.change(); h.controller.refresh();
    second.resolve({ status: "LIVE" }); await request;
    expect(peak).toBe(1); expect(h.fetch).toHaveBeenCalledTimes(3);
    h.controller.dispose();
  });

  it("uses 15s healthy / 5s unhealthy fallback and Realtime-driven refresh", async () => {
    const h = harness(); h.controller.start(); await flush(); h.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(14999); expect(h.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(h.fetch).toHaveBeenCalledTimes(2);
    h.change(); await flush(); expect(h.fetch).toHaveBeenCalledTimes(3);
    h.status("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(4999); expect(h.fetch).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1); expect(h.fetch).toHaveBeenCalledTimes(4);
    h.controller.dispose();
  });

  it("backs consecutive fetch errors off 5s, 10s, 30s, 60s and resets on success", async () => {
    const h = harness(); h.controller.start(); await flush(); h.status("SUBSCRIBED");
    h.fetch.mockRejectedValue(new Error("offline")); await h.controller.refresh();
    for (const delay of [5000, 10000, 30000, 60000, 60000]) {
      const count = h.fetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1); expect(h.fetch).toHaveBeenCalledTimes(count);
      await vi.advanceTimersByTimeAsync(1); expect(h.fetch).toHaveBeenCalledTimes(count + 1);
    }
    h.fetch.mockResolvedValue({ status: "LIVE" }); await h.controller.refresh();
    const count = h.fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15000); expect(h.fetch).toHaveBeenCalledTimes(count + 1);
    h.controller.dispose();
  });

  it("pauses hidden fallback and catches up immediately when visible", async () => {
    const h = harness(); h.controller.start(); await flush(); h.status("SUBSCRIBED");
    h.visibility(false); h.change(); await vi.advanceTimersByTimeAsync(120000);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    h.visibility(true); await flush(); expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.subscribe).toHaveBeenCalledTimes(1); h.controller.dispose();
  });

  it.each(["CLOSED", "FINALIZED"])("stops fallback for server room terminal %s", async (status) => {
    const h = harness(); h.fetch.mockResolvedValue({ status }); h.controller.start(); await flush();
    h.status("SUBSCRIBED"); await vi.advanceTimersByTimeAsync(120000);
    expect(h.fetch).toHaveBeenCalledTimes(1); h.controller.dispose();
  });

  it("discards a fetch result after cleanup", async () => {
    const h = harness(); const pending = deferred<{ status: string }>();
    h.fetch.mockImplementationOnce(() => pending.promise); h.controller.start(); await flush();
    h.controller.dispose(); pending.resolve({ status: "LIVE" }); await flush();
    expect(h.onView).not.toHaveBeenCalled(); expect(h.subscribe).not.toHaveBeenCalled();
  });

  it("retries an initial transport failure without establishing a subscription prematurely", async () => {
    const h = harness(); h.fetch.mockRejectedValueOnce(new Error("network"));
    h.controller.start(); await flush(); expect(h.subscribe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.fetch).toHaveBeenCalledTimes(2); expect(h.subscribe).toHaveBeenCalledTimes(1);
    h.controller.dispose();
  });

  it("binds React lifecycle only to roomId and checks disposal before creating Supabase channels", () => {
    const hook = readFileSync("lib/live-room/use-room-refresh.ts", "utf8");
    expect(hook).toContain("}, [roomId]);");
    expect(hook).not.toMatch(/\[[^\]]*\b(view|options)\b[^\]]*\]/);
    for (const name of ["auction", "world"]) {
      const component = readFileSync(`components/live-${name}/live-${name}-room.tsx`, "utf8");
      expect(component).toContain("useRoomRefresh(roomId,");
      expect(component).not.toContain("}, 1500)");
      const api = readFileSync(`lib/supabase/live-${name}.ts`, "utf8");
      expect(api).toMatch(/await ensureLive\w+Session\(\);\s*if \(disposed\(\)\) return null;/);
    }
  });
});
