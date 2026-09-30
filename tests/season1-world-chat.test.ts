import { describe, expect, it, vi, beforeEach } from "vitest";
import { createChatSync } from "@/lib/season1/chat-sync";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: mocks.client,
  requireSupabaseBrowserClient: mocks.client,
  throwIfSupabaseError: (error: { message: string } | null) => { if (error) throw new Error(error.message); },
}));
import { getSeason1WorldMessages, subscribeToSeason1WorldChat } from "@/lib/supabase/season1-world-chat";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("world chat synchronization", () => {
  it("coalesces a burst during a read, then fetches the latest messages without concurrent reads", async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const read = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onData = vi.fn();
    const sync = createChatSync({ read, onData, onError: vi.fn() });
    const pending = sync.refresh();
    void sync.refresh(); void sync.refresh(); void sync.refresh();
    expect(read).toHaveBeenCalledTimes(1);
    first.resolve(["old"]);
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(2);
    second.resolve(["old", "new"]);
    await pending;
    expect(onData.mock.calls).toEqual([[["old"]], [["old", "new"]]]);
  });

  it("keeps the existing chat on failure and can retry", async () => {
    const error = new Error("offline");
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(["recovered"]);
    const onData = vi.fn(), onError = vi.fn();
    const sync = createChatSync({ read, onData, onError });
    await sync.refresh();
    expect(onData).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    await sync.refresh();
    expect(onData).toHaveBeenCalledWith(["recovered"]);
  });

  it("ignores in-flight reads and queued notifications after navigating away", async () => {
    const request = deferred<string[]>();
    const read = vi.fn(() => request.promise), onData = vi.fn();
    const sync = createChatSync({ read, onData, onError: vi.fn() });
    const pending = sync.refresh();
    void sync.refresh();
    sync.dispose();
    request.resolve(["private old page"]);
    await pending;
    await sync.refresh();
    expect(onData).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("world chat channel API", () => {
  beforeEach(() => mocks.client.mockReset());
  it("reads only a bounded world channel through the participant API", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "message" }], error: null });
    mocks.client.mockReturnValue({ rpc });
    expect(await getSeason1WorldMessages()).toEqual([{ id: "message" }]);
    expect(rpc).toHaveBeenCalledWith("get_world_preseason_world_messages", { p_message_limit: 100 });
  });
  it("surfaces server errors instead of erasing messages", async () => {
    mocks.client.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Access denied" } }) });
    await expect(getSeason1WorldMessages()).rejects.toThrow("Access denied");
  });
  it("subscribes to chat changes without subscribing to team mutations", () => {
    const onChange = vi.fn();
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    mocks.client.mockReturnValue({ channel: vi.fn(() => channel) });
    expect(subscribeToSeason1WorldChat(onChange)).toBe(channel);
    expect(channel.on).toHaveBeenCalledExactlyOnceWith("postgres_changes", {
      event: "*", schema: "public", table: "world_preseason_chat_messages",
    }, onChange);
  });
  it("keeps the opening gate, limits world-only reads, and deploys the API before exporting the website", () => {
    const sql = readFileSync("supabase/migrations/20260930010000_season1_world_chat.sql", "utf8");
    const deploy = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
    expect(sql).toContain("perform public.world_preseason_require_participant()");
    expect(sql).toContain("s.code = 'season-1' and c.channel_type = 'LOBBY'");
    expect(sql).toContain("least(coalesce(p_message_limit, 100), 100)");
    expect(sql).toContain("from public, anon");
    expect(deploy.indexOf("Apply Season 1 World Chat read API")).toBeLessThan(deploy.indexOf("Export static website"));
  });
});
