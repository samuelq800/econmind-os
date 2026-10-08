/** Runtime-independent handlers. No raw codes, addresses, hashes or sessions in logs. */
export type Purpose = "signup" | "recovery";
export type Claim = {
  status: "ready" | "legacy" | "invalid" | "limited" | "busy";
  lease?: string;
  code_cipher?: string;
  hash_ciphers?: string[];
  expires_at?: string;
};
export interface CodeStore {
  send(
    subject: string,
    purpose: Purpose,
    code: string,
    hash: string,
  ): Promise<Claim>;
  claim(subject: string, peer: string): Promise<Claim>;
  finish(subject: string, lease: string, consumed: boolean): Promise<boolean>;
}
export interface Session {
  access_token: string;
  refresh_token: string;
}
export interface Dependencies {
  publicActive?: boolean;
  store: CodeStore;
  secret: string;
  verifyNative(
    hash: string,
    purpose: Purpose,
    peer: string,
  ): Promise<Session | null>;
  verifyLegacy(
    email: string,
    token: string,
    purpose: Purpose,
    peer: string,
  ): Promise<Session | null>;
  sendMail(
    to: string,
    code: string,
    purpose: string,
    expiresAt?: string,
    link?: string,
  ): Promise<void>;
  authenticateHook(body: string, headers: Headers): unknown;
  now?: () => number;
}
const utf8 = new TextEncoder();
function bytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function base64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}
export async function subjectKey(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, utf8.encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function seal(secret: string, value: string, context: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode(context) },
    key,
    utf8.encode(value),
  );
  return `${base64(iv)}.${base64(new Uint8Array(cipher))}`;
}
export async function unseal(secret: string, value: string, context: string) {
  const [iv, cipher] = value.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(iv), additionalData: utf8.encode(context) },
      key,
      bytes(cipher),
    ),
  );
}
export function sameCode(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < 8; i++)
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}
const origins = new Set([
  "https://econmind.group",
  "https://www.econmind.group",
  "https://samuelq800.github.io",
]);
function cors(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed =
    origins.has(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
}
function reply(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors(request) });
}
const invalid = {
  code: "otp_expired",
  message: "Code is invalid, expired, or already used.",
};
const limited = {
  code: "over_request_rate_limit",
  message: "Please wait before trying again.",
};
function email(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid email");
  const result = value.trim().toLowerCase();
  if (result.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new Error("Invalid email");
  return result;
}
async function bodyText(request: Request) {
  // Enforce a real byte bound, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 32_768) throw new Error("Body too large");
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(all);
}

export function createVerifyCodeHandler(deps: Dependencies) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") return reply(request, {});
    if (request.method === "GET")
      return reply(request, { fixedWindowEnabled: deps.publicActive === true });
    if (request.method !== "POST") return reply(request, invalid, 405);
    const origin = request.headers.get("origin");
    if (origin && !cors(request)["Access-Control-Allow-Origin"])
      return reply(request, invalid, 403);
    let input: { email: unknown; purpose: unknown; token: unknown };
    let address: string;
    try {
      input = JSON.parse(await bodyText(request));
      address = email(input.email);
      if (
        !["signup", "recovery"].includes(String(input.purpose)) ||
        typeof input.token !== "string" ||
        !/^\d{8}$/.test(input.token)
      )
        throw new Error("Invalid code");
    } catch {
      return reply(request, invalid, 400);
    }
    const purpose = input.purpose as Purpose;
    let subject = "";
    let lease: string | undefined;
    let nativeConsumed = false;
    try {
      subject = await subjectKey(deps.secret, `${purpose}:${address}`);
      // Supabase's gateway appends the actual remote address; never trust the
      // leftmost, user-provided X-Forwarded-For element. Shared unknown bucket is fail-closed.
      const peer =
        (request.headers.get("x-forwarded-for") ?? "unknown")
          .split(",")
          .at(-1)!
          .trim() || "unknown";
      const claim = await deps.store.claim(
        subject,
        await subjectKey(deps.secret, `verify-peer:${peer}`),
      );
      if (claim.status === "limited") return reply(request, limited, 429);
      if (claim.status === "legacy") {
        // Never reveal whether a pending challenge/account exists to a browser.
        const session = await deps.verifyLegacy(
          address,
          input.token as string,
          purpose,
          peer,
        );
        return session
          ? reply(request, { session })
          : reply(request, invalid, 403);
      }
      if (claim.status !== "ready") return reply(request, invalid, 403);
      lease = claim.lease;
      if (
        !lease ||
        !claim.code_cipher ||
        !claim.hash_ciphers ||
        Date.parse(claim.expires_at!) <= (deps.now?.() ?? Date.now())
      )
        throw new Error("Invalid cache");
      const code = await unseal(
        deps.secret,
        claim.code_cipher,
        `${subject}:code`,
      );
      if (!sameCode(code, input.token as string))
        return reply(request, invalid, 403);
      // Native Auth remains the authority: bans, purpose, expiry, token use,
      // and session issuance are never implemented by this cache.
      for (const cipher of claim.hash_ciphers.slice(0, 8)) {
        const hash = await unseal(deps.secret, cipher, `${subject}:hash`);
        const session = await deps.verifyNative(hash, purpose, peer);
        if (session) {
          nativeConsumed = true;
          if (!(await deps.store.finish(subject, lease, true)))
            throw new Error("Lost lease");
          lease = undefined;
          return reply(request, { session });
        }
      }
      // A just-arriving hook may precede native Auth's token commit. Do not
      // consume on rejection; successful native verification alone consumes.
      return reply(request, invalid, 403);
    } catch {
      return reply(
        request,
        {
          code: "service_unavailable",
          message: "Verification temporarily unavailable.",
        },
        503,
      );
    } finally {
      if (lease) {
        try {
          await deps.store.finish(subject, lease, nativeConsumed);
        } catch {
          /* Lease expires; never log secrets. */
        }
      }
    }
  };
}

type HookPayload = {
  user: { email: string; new_email?: string };
  email_data: {
    email_action_type: string;
    token: string;
    token_hash: string;
    token_new?: string;
    token_hash_new?: string;
    site_url: string;
    redirect_to: string;
  };
};
export function createStableEmailHook(deps: Dependencies) {
  return async (request: Request) => {
    if (request.method !== "POST") return reply(request, {}, 405);
    let payload: HookPayload;
    try {
      payload = deps.authenticateHook(
        await bodyText(request),
        request.headers,
      ) as HookPayload;
    } catch {
      return reply(
        request,
        { error: { http_code: 401, message: "Invalid hook signature." } },
        401,
      );
    }
    try {
      const { user, email_data: data } = payload;
      const purpose = data.email_action_type;
      if (purpose === "signup" || purpose === "recovery") {
        const address = email(user.email);
        if (
          !/^\d{8}$/.test(data.token) ||
          !/^[a-f0-9]{32,128}$/i.test(data.token_hash)
        )
          throw new Error("Invalid native token");
        const subject = await subjectKey(deps.secret, `${purpose}:${address}`);
        const record = await deps.store.send(
          subject,
          purpose,
          await seal(deps.secret, data.token, `${subject}:code`),
          await seal(deps.secret, data.token_hash, `${subject}:hash`),
        );
        if (record.status !== "ready" || !record.code_cipher)
          return reply(
            request,
            {
              error: {
                http_code: 429,
                message: "Please wait before requesting another email.",
              },
            },
            429,
          );
        const code = await unseal(
          deps.secret,
          record.code_cipher,
          `${subject}:code`,
        );
        await deps.sendMail(address, code, purpose, record.expires_at);
      } else {
        // Preserve unused native flows rather than silently changing secure
        // double email-change, invitation, magic-link or reauthentication semantics.
        if (
          !["invite", "magiclink", "email_change", "reauthentication"].includes(
            purpose,
          )
        )
          throw new Error("Unsupported native mail");
        const sendNative = async (
          address: string,
          code: string,
          hash: string,
        ) => {
          if (!/^\d{6,10}$/.test(code) || !/^[a-f0-9]{32,128}$/i.test(hash))
            throw new Error("Invalid native token");
          const base = new URL(
            "/auth/v1/verify",
            "https://vimksjrhaxdpnkvgsavz.supabase.co",
          );
          base.searchParams.set("token", hash);
          base.searchParams.set("type", purpose);
          // Auth revalidates this redirect against its configured allow-list.
          base.searchParams.set("redirect_to", data.redirect_to);
          await deps.sendMail(
            email(address),
            code,
            purpose,
            undefined,
            base.toString(),
          );
        };
        if (purpose === "email_change" && data.token_hash_new) {
          await sendNative(user.email, data.token, data.token_hash_new);
          await sendNative(user.new_email!, data.token_new!, data.token_hash);
        } else
          await sendNative(
            purpose === "email_change" ? user.new_email! : user.email,
            data.token || data.token_new!,
            data.token_hash,
          );
      }
      return reply(request, {});
    } catch {
      return reply(
        request,
        {
          error: {
            http_code: 503,
            message: "Authentication email temporarily unavailable.",
          },
        },
        503,
      );
    }
  };
}
