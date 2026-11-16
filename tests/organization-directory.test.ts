import { afterEach, describe, expect, it, vi } from "vitest";
import { watchOrganizationDirectory } from "@/lib/supabase/organization-directory";

const state = vi.hoisted(() => ({ rpc: vi.fn(), removeChannel: vi.fn(), callback: null as null | (() => void) }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    rpc: state.rpc,
    removeChannel: state.removeChannel,
    channel: () => {
      const channel = {
        on: (_type: string, _filter: unknown, callback: () => void) => { state.callback = callback; return channel; },
        subscribe: () => channel,
      };
      return channel;
    },
  }),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); state.rpc.mockReset(); state.removeChannel.mockReset(); state.callback = null; });

describe("organization directory updates", () => {
  it("coalesces events during a fetch and stops updating after cleanup", async () => {
    vi.stubGlobal("window", { setInterval: () => 1, clearInterval: vi.fn() });
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    let resolveFirst!: (value: unknown) => void;
    state.rpc.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: { activated: true, appointments: [] }, error: null });
    const update = vi.fn();
    const stop = watchOrganizationDirectory(update, vi.fn());
    state.callback?.();
    state.callback?.();
    expect(state.rpc).toHaveBeenCalledTimes(1);
    resolveFirst({ data: { activated: false, appointments: [] }, error: null });
    await vi.waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    stop();
    state.callback?.();
    expect(state.rpc).toHaveBeenCalledTimes(2);
    expect(state.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("discards a response that arrives after the watcher is disposed", async () => {
    vi.stubGlobal("window", { setInterval: () => 1, clearInterval: vi.fn() });
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
    let resolve!: (value: unknown) => void;
    state.rpc.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const update = vi.fn();
    const stop = watchOrganizationDirectory(update, vi.fn());
    stop();
    resolve({ data: { activated: true, appointments: [] }, error: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
  });
});
