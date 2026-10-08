import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.7";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import type { Dependencies } from "./stable-email-codes.ts";

export function stableEmailDependencies(): Dependencies {
  const url = Deno.env.get("SUPABASE_URL");
  const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const key = Deno.env.get("STABLE_EMAIL_CODE_KEY");
  const hook = Deno.env.get("STABLE_EMAIL_HOOK_SECRET");
  const brevo = Deno.env.get("BREVO_API_KEY");
  const authKey = Deno.env.get("STABLE_EMAIL_AUTH_SECRET_KEY");
  if (
    !url ||
    !role ||
    !key ||
    !hook ||
    !brevo ||
    !authKey?.startsWith("sb_secret_")
  )
    throw new Error("Mail configuration incomplete");
  const client = createClient(url, role, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error("Challenge storage unavailable");
    return data;
  };
  const verify = async (body: Record<string, string>, peer: string) => {
    // This is the normal native /verify endpoint, never an admin confirmation
    // endpoint. A protected secret API key permits documented IP forwarding,
    // avoiding one shared Edge-IP rate bucket for all registered users.
    const response = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: authKey,
        "Content-Type": "application/json",
        ...(peer !== "unknown" ? { "Sb-Forwarded-For": peer } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if ([400, 401, 403, 404, 422].includes(response.status)) return null;
    if (!response.ok) throw new Error("Auth verification unavailable");
    const session = await response.json();
    if (!session.access_token || !session.refresh_token)
      throw new Error("Missing verified session");
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
  };
  return {
    publicActive: Deno.env.get("STABLE_EMAIL_PUBLIC_ACTIVE") === "true",
    secret: key,
    store: {
      send: (subject, purpose, code, hash) =>
        rpc("stable_email_code_send", {
          p_subject: subject,
          p_purpose: purpose,
          p_code_cipher: code,
          p_hash_cipher: hash,
        }),
      claim: (subject, peer) =>
        Deno.env.get("STABLE_EMAIL_CODES_ENABLED") === "true"
          ? rpc("stable_email_code_claim", { p_subject: subject, p_peer: peer })
          : Promise.resolve({ status: "legacy" as const }),
      finish: (subject, lease, consumed) =>
        rpc("stable_email_code_finish", {
          p_subject: subject,
          p_lease: lease,
          p_consumed: consumed,
        }),
    },
    authenticateHook: (body, headers) =>
      new Webhook(hook.replace(/^v1,whsec_/, "")).verify(
        body,
        Object.fromEntries(headers),
      ),
    verifyNative: (hash, purpose, peer) =>
      verify(
        { token_hash: hash, type: purpose === "signup" ? "email" : "recovery" },
        peer,
      ),
    verifyLegacy: (email, token, purpose, peer) =>
      verify(
        { email, token, type: purpose === "signup" ? "email" : "recovery" },
        peer,
      ),
    sendMail: async (to, code, purpose, expiresAt, link) => {
      const action =
        purpose === "signup"
          ? "Verify your email"
          : purpose === "recovery"
            ? "Recover your account"
            : "Confirm your account action";
      const expiry = expiresAt
        ? `This code expires at ${new Date(expiresAt).toISOString()} (UTC). Resending within its 60-minute window sends the same code and does not extend the expiry.`
        : "This code is valid for up to 60 minutes and can only be used once.";
      const target = link ?? "https://econmind.group/";
      const text = `${action}\n\n${code}\n\n${expiry}\n\nEnter this code in the EconMind window where you requested it. Never share your code. If you did not request this, ignore this email.\n\n${target}`;
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "EconMind", email: "admin@econmind.group" },
          to: [{ email: to }],
          subject: `EconMind — ${action}`,
          textContent: text,
        }),
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) throw new Error("Mail delivery unavailable");
    },
  };
}
