import { acceptedRegistrationLegalPair } from "../../../lib/legal/legal-config.ts";
import { registrationPolicyMetadata } from "../../../lib/legal/registration-consent.ts";

type Authorization = {
  status: "new" | "pending" | "invalid" | "limited" | "unavailable";
  user_id?: string;
};
export type GroupAccount = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  banned_until?: string;
  is_anonymous?: boolean;
  identities?: { provider: string }[];
  app_metadata: Record<string, unknown>;
};
export interface GroupRegistrationDependencies {
  authorize(code: string, email: string, peer: string): Promise<Authorization>;
  peerKey(peer: string): Promise<string>;
  createAccount(
    email: string,
    password: string,
    metadata: Record<string, unknown>,
    audit: Record<string, unknown>,
  ): Promise<void>;
  getAccount(id: string): Promise<GroupAccount>;
  provePendingPassword(email: string, password: string): Promise<boolean>;
  activateAccount(
    id: string,
    appMetadata: Record<string, unknown>,
  ): Promise<void>;
  now?: () => number;
}

const allowedOrigins = new Set([
  "https://econmind.group",
  "https://www.econmind.group",
  "https://samuelq800.github.io",
  "http://localhost:3000",
]);
const invalidMessage =
  "Could not complete group registration. Check the group code and your original password, or use sign in or email recovery.";

async function readBody(request: Request) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 4096))
    throw new Error("Invalid body size");
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Auth must validate the password and return this exact unconfirmed error. */
export async function provePendingRegistrationPassword(
  url: string,
  anonKey: string,
  email: string,
  password: string,
  closeSession: (accessToken: string) => Promise<void>,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetcher(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json();
  if (response.ok && body.access_token) await closeSession(body.access_token);
  return response.status === 400 && body.error_code === "email_not_confirmed";
}

/** A group code authorizes this registration exception, never password recovery. */
export function createGroupRegistrationHandler(
  deps: GroupRegistrationDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Origin":
        origin && allowedOrigins.has(origin)
          ? origin
          : "https://econmind.group",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const reply = (body: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowedOrigins.has(origin))
      return reply({ code: "request_rejected", message: invalidMessage }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply({ code: "request_rejected", message: invalidMessage }, 405);
    try {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new Error("Invalid body");
      const body = await readBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("Invalid body");
      const { email, password, code, displayName, legalAcceptance } = body;
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 1024 ||
        typeof code !== "string" ||
        code.length > 128 ||
        (displayName !== undefined &&
          (typeof displayName !== "string" || displayName.length > 80)) ||
        legalAcceptance?.terms !== true ||
        legalAcceptance?.privacy !== true ||
        !acceptedRegistrationLegalPair(
          legalAcceptance?.termsVersion,
          legalAcceptance?.privacyVersion,
        )
      ) {
        return reply(
          {
            code: "invalid_request",
            message:
              "Enter a valid email, password and group code, and accept the current Terms and Privacy Notice.",
          },
          400,
        );
      }
      const address = email.trim().toLowerCase();
      // A shared global bucket cannot be bypassed with a forged forwarding IP.
      const peer = "global-group-registration";
      const authorized = await deps.authorize(
        code,
        address,
        await deps.peerKey(peer),
      );
      if (authorized.status === "limited")
        return reply(
          {
            code: "over_request_rate_limit",
            message:
              "Too many registration attempts. Please wait ten minutes before trying again.",
          },
          429,
        );
      if (authorized.status === "unavailable")
        return reply(
          {
            code: "group_registration_unavailable",
            message:
              "Group registration is unavailable. Use email verification or Google sign-in.",
          },
          503,
        );
      if (authorized.status === "invalid")
        return reply(
          { code: "registration_rejected", message: invalidMessage },
          400,
        );
      const audit = {
        method: "shared_group_code",
        email_ownership_verified: false,
        activated_at: new Date((deps.now ?? Date.now)()).toISOString(),
      };
      if (authorized.status === "new") {
        await deps.createAccount(
          address,
          password,
          {
            display_name: displayName?.trim() || null,
            legal_acceptance: {
              terms_version: legalAcceptance.termsVersion,
              privacy_version: legalAcceptance.privacyVersion,
            },
            policy_acknowledgement: registrationPolicyMetadata(legalAcceptance),
          },
          { group_registration: audit },
        );
      } else if (authorized.status === "pending" && authorized.user_id) {
        // Native Auth checks the original password BEFORE email_not_confirmed.
        // Never confirm an account merely because someone knows the group code.
        if (!(await deps.provePendingPassword(address, password)))
          return reply(
            { code: "registration_rejected", message: invalidMessage },
            400,
          );
        // Re-read after proving the password; confirmed, banned and OAuth accounts
        // never enter this path. No passwords, roles or user metadata are updated.
        const user = await deps.getAccount(authorized.user_id);
        if (
          user.id !== authorized.user_id ||
          user.email?.toLowerCase() !== address ||
          user.email_confirmed_at ||
          user.is_anonymous ||
          (user.banned_until &&
            Date.parse(user.banned_until) > (deps.now ?? Date.now)()) ||
          !user.identities?.length ||
          user.identities.some((identity) => identity.provider !== "email")
        ) {
          return reply(
            { code: "registration_rejected", message: invalidMessage },
            400,
          );
        }
        await deps.activateAccount(user.id, {
          ...user.app_metadata,
          group_registration: audit,
        });
      } else {
        return reply(
          { code: "registration_rejected", message: invalidMessage },
          400,
        );
      }
      // No tokens or user identifiers cross this endpoint. The browser signs in
      // normally with its password, then records current consent through its RPC.
      return reply({ ok: true });
    } catch {
      return reply(
        { code: "registration_rejected", message: invalidMessage },
        400,
      );
    }
  };
}
