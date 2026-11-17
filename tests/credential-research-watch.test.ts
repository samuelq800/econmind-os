import { afterEach, expect, it, vi } from "vitest";
import { watchCredentialResearchSources } from "@/lib/supabase/credential-research-sources";

const state = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn(), event: null as null | (() => void) }));
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({
    rpc: state.rpc, removeChannel: state.remove,
    channel: () => { const channel = { on: (_: string, _filter: unknown, callback: () => void) => { state.event = callback; return channel; }, subscribe: () => channel }; return channel; },
  }),
  throwIfSupabaseError: (error: unknown) => { if (error) throw error; },
}));
afterEach(() => { vi.unstubAllGlobals(); state.rpc.mockReset(); state.remove.mockReset(); state.event = null; });

it("coalesces source changes and ignores a late response after cleanup", async () => {
  vi.stubGlobal("window", { setInterval: () => 1, clearInterval: vi.fn() });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  let finish!: (value: unknown) => void;
  state.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ data: [], error: null });
  const update = vi.fn();
  const stop = watchCredentialResearchSources(update, vi.fn());
  state.event?.(); state.event?.();
  expect(state.rpc).toHaveBeenCalledTimes(1);
  finish({ data: [], error: null });
  await vi.waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  stop();
  state.event?.();
  expect(state.rpc).toHaveBeenCalledTimes(2);
  expect(state.remove).toHaveBeenCalledTimes(1);
});
