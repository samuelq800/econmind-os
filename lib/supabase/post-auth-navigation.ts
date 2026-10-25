export function shouldGoHomeAfterAuth(
  event: string,
  previousUserId: string | null,
  nextUser: { id: string; is_anonymous?: boolean } | null,
  recovery: boolean,
  initialSessionReady: boolean,
) {
  return (
    // Supabase also emits SIGNED_IN while restoring persisted sessions, before
    // INITIAL_SESSION. That is not a new login and must not navigate the page.
    initialSessionReady &&
    event === "SIGNED_IN" &&
    nextUser !== null &&
    !nextUser.is_anonymous &&
    nextUser.id !== previousUserId &&
    !recovery
  );
}
