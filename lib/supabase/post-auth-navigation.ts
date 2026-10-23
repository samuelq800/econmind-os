export function shouldGoHomeAfterAuth(
  event: string,
  previousUserId: string | null,
  nextUser: { id: string; is_anonymous?: boolean } | null,
  recovery: boolean,
) {
  return (
    event === "SIGNED_IN" &&
    nextUser !== null &&
    !nextUser.is_anonymous &&
    nextUser.id !== previousUserId &&
    !recovery
  );
}
