// Presentation preference only, never an authorization decision.
// last_sign_in_at is stable across token refreshes and changes on a new login.
const prefix = "econmind-season1-entrance-v1:";
const memory = new Map<string, string>();
type LoginIdentity = { id: string; last_sign_in_at?: string };
type VisitStorage = Pick<Storage, "getItem" | "setItem">;

export function hasSeenSeason1Entrance(user: LoginIdentity, storage?: VisitStorage) {
  if (!user.last_sign_in_at) return false;
  try {
    return (storage?.getItem(prefix + user.id) ?? memory.get(user.id)) === user.last_sign_in_at;
  } catch {
    return memory.get(user.id) === user.last_sign_in_at;
  }
}

export function markSeason1EntranceSeen(user: LoginIdentity, storage?: VisitStorage) {
  if (!user.last_sign_in_at) return;
  memory.set(user.id, user.last_sign_in_at);
  try { storage?.setItem(prefix + user.id, user.last_sign_in_at); } catch { /* Storage may be unavailable in private browsing. */ }
}

export function entranceVisitStorage(): VisitStorage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
