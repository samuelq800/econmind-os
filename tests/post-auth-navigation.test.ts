import { describe, expect, it } from "vitest";
import { shouldGoHomeAfterAuth } from "@/lib/supabase/post-auth-navigation";
describe("one-time homepage redirect", () => {
  it("redirects new sign-ins and account switches", () => {
    expect(shouldGoHomeAfterAuth("SIGNED_IN", null, { id: "new" }, false)).toBe(
      true,
    );
    expect(
      shouldGoHomeAfterAuth("SIGNED_IN", "old", { id: "new" }, false),
    ).toBe(true);
  });
  it("does not interrupt page loads, focus sign-in events, recovery, anonymous rooms or token refresh", () => {
    for (const event of [
      "INITIAL_SESSION",
      "TOKEN_REFRESHED",
      "USER_UPDATED",
      "PASSWORD_RECOVERY",
      "SIGNED_OUT",
    ])
      expect(shouldGoHomeAfterAuth(event, null, { id: "user" }, false)).toBe(
        false,
      );
    expect(
      shouldGoHomeAfterAuth("SIGNED_IN", "user", { id: "user" }, false),
    ).toBe(false);
    expect(
      shouldGoHomeAfterAuth(
        "SIGNED_IN",
        null,
        { id: "room", is_anonymous: true },
        false,
      ),
    ).toBe(false);
    expect(shouldGoHomeAfterAuth("SIGNED_IN", null, { id: "user" }, true)).toBe(
      false,
    );
    expect(shouldGoHomeAfterAuth("SIGNED_IN", null, null, false)).toBe(false);
  });
});
