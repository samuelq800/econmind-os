import {
  directAccountAddress,
  isRecoveryEmail,
  normalizeRegistrationId,
  validRegistrationId,
} from "../../../lib/supabase/account-identifier.ts";
import {
  registrationConsentComplete,
  registrationPolicyMetadata,
} from "../../../lib/legal/registration-consent.ts";
import { LEGAL_DOCUMENTS } from "../../../lib/legal/legal-config.ts";

export type DirectRegistrationDependencies = {
  authorize(
    address: string,
  ): Promise<"new" | "invalid" | "limited" | "unavailable">;
  createAccount(
    address: string,
    password: string,
    metadata: Record<string, unknown>,
    audit: Record<string, unknown>,
  ): Promise<void>;
};
const origins = new Set([
  "https://econmind.group",
  "https://www.econmind.group",
  "https://samuelq800.github.io",
  "http://localhost:3000",
]);
export function createDirectRegistrationHandler(
  deps: DirectRegistrationDependencies,
) {
  return async (request: Request) => {
    const origin = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Origin":
        origin && origins.has(origin) ? origin : "https://econmind.group",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    };
    const reply = (status: number, body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !origins.has(origin))
      return reply(403, { code: "request_rejected" });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply(405, { code: "request_rejected" });
    try {
      if (
        !request.headers.get("content-type")?.startsWith("application/json") ||
        !request.body
      )
        throw new Error("Invalid request");
      const reader = request.body.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 8192) {
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
        offset += chunk.length;
      }
      const body = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("Invalid request");
      const { identifier, password, displayName, legalAcceptance } = body;
      if (
        !validRegistrationId(identifier) ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 1024 ||
        typeof displayName !== "string" ||
        !displayName.trim() ||
        displayName.length > 80 ||
        !registrationConsentComplete(legalAcceptance ?? {}) ||
        legalAcceptance.termsVersion !== LEGAL_DOCUMENTS.terms.version ||
        legalAcceptance.privacyVersion !== LEGAL_DOCUMENTS.privacy.version
      )
        return reply(400, { code: "invalid_request" });
      const address = await directAccountAddress(identifier);
      const status = await deps.authorize(address);
      if (status === "limited")
        return reply(429, { code: "over_request_rate_limit" });
      if (status === "unavailable")
        return reply(503, { code: "registration_unavailable" });
      if (status !== "new")
        return reply(400, { code: "registration_rejected" });
      // Explicit allowlists: ignore supplied roles, user IDs, verification flags,
      // callback URLs and audit metadata. Existing accounts are NEVER updated.
      await deps.createAccount(
        address,
        password,
        {
          display_name: displayName.trim(),
          legal_acceptance: {
            terms_version: LEGAL_DOCUMENTS.terms.version,
            privacy_version: LEGAL_DOCUMENTS.privacy.version,
          },
          policy_acknowledgement: registrationPolicyMetadata(legalAcceptance),
          registration_id: normalizeRegistrationId(identifier),
        },
        {
          direct_registration: {
            method: "direct_link",
            email_ownership_verified: false,
            email_recovery_available: isRecoveryEmail(identifier),
          },
        },
      );
      return reply(200, { ok: true });
    } catch {
      return reply(400, { code: "registration_rejected" });
    }
  };
}
