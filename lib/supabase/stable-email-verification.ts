import type { SupabaseClient } from "@supabase/supabase-js";

/** New requests still use native Auth (captcha, legal metadata, rate limits).
 * Only code verification bridges the fixed outward code to native Auth. */
export async function verifyStableEmailCode(
  client: SupabaseClient,
  email: string,
  token: string,
  purpose: "signup" | "recovery",
) {
  const { data, error } = await client.functions.invoke("verify-stable-email", {
    body: { email, token, purpose },
  });
  if (error) {
    let code = "service_unavailable";
    // Do not expose raw function/provider errors or account existence.
    try {
      const payload = await error.context?.json();
      if (["otp_expired", "over_request_rate_limit"].includes(payload?.code))
        code = payload.code;
    } catch {
      /* transport error */
    }
    throw { code, status: code === "over_request_rate_limit" ? 429 : 503 };
  }
  if (!data?.session?.access_token || !data?.session?.refresh_token)
    throw { code: "service_unavailable" };
  const { error: sessionError } = await client.auth.setSession(data.session);
  if (sessionError) throw sessionError;
}
