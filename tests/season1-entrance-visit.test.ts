import { describe, expect, it } from "vitest";
import { hasSeenSeason1Entrance, markSeason1EntranceSeen } from "../lib/season1/entrance-visit";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
describe("Season 1 entrance per login", () => {
  it("shows on first visit, then skips within the same login including token refresh", () => {
    const store = storage(), user = { id: "first", last_sign_in_at: "2026-09-27T01:00:00Z" };
    expect(hasSeenSeason1Entrance(user, store)).toBe(false);
    markSeason1EntranceSeen(user, store);
    expect(hasSeenSeason1Entrance({ ...user }, store)).toBe(true);
    expect(hasSeenSeason1Entrance({ ...user, last_sign_in_at: "2026-09-27T02:00:00Z" }, store)).toBe(false);
  });
  it("isolates users and shares the presentation marker between tabs", () => {
    const store = storage(), user = { id: "tab-user", last_sign_in_at: "login-1" };
    markSeason1EntranceSeen(user, store);
    expect(hasSeenSeason1Entrance(user, { getItem: store.getItem, setItem: store.setItem })).toBe(true);
    expect(hasSeenSeason1Entrance({ ...user, id: "other-user" }, store)).toBe(false);
  });
  it("uses an in-memory fallback if storage is unavailable", () => {
    const blocked = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); } };
    const user = { id: "private-mode", last_sign_in_at: "login-1" };
    markSeason1EntranceSeen(user, blocked);
    expect(hasSeenSeason1Entrance(user, blocked)).toBe(true);
    expect(hasSeenSeason1Entrance({ ...user, last_sign_in_at: "login-2" }, blocked)).toBe(false);
  });
  it("does not persist a permanent skip when login identity is unavailable", () => {
    const user = { id: "missing-login" }, store = storage();
    markSeason1EntranceSeen(user, store);
    expect(hasSeenSeason1Entrance(user, store)).toBe(false);
  });
});
