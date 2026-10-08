import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, createHash, createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "vimksjrhaxdpnkvgsavz";
export const HOOK_URI = `https://${PROJECT}.supabase.co/functions/v1/stable-auth-email`;
const fields = [
  "mailer_otp_exp",
  "hook_send_email_enabled",
  "hook_send_email_uri",
  "hook_send_email_secrets",
  "security_sb_forwarded_for_enabled",
];
export function unrelatedFingerprint(config) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(config)
            .filter(([k]) => !fields.includes(k))
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .digest("hex");
}
export function assertPreflight(config) {
  if (config.hook_send_email_enabled)
    throw new Error(
      "An email hook is already enabled; refusing to replace its keys or configuration.",
    );
  if (config.mailer_autoconfirm !== false || config.mailer_otp_length !== 8)
    throw new Error(
      "Email confirmation and eight-digit codes must remain enabled.",
    );
  if (!Number.isInteger(config.mailer_otp_exp))
    throw new Error("Missing native expiry preflight");
}
export function activationPatch(hookSecret) {
  return {
    mailer_otp_exp: 3600,
    hook_send_email_enabled: true,
    hook_send_email_uri: HOOK_URI,
    hook_send_email_secrets: hookSecret,
    security_sb_forwarded_for_enabled: true,
  };
}

async function main() {
  const [phase, statePath] = process.argv.slice(2);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (
    !["prepare", "activate"].includes(phase) ||
    !statePath ||
    !token ||
    process.env.SUPABASE_PROJECT_REF !== PROJECT
  )
    throw new Error(
      "The approved project and scoped deployment phase are required.",
    );
  const api = async (path, method = "GET", payload) => {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT}/${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Scoped ${method} ${path} failed (HTTP ${response.status}); provider body omitted.`,
      );
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  const secrets = (values) =>
    api(
      "secrets",
      "POST",
      Object.entries(values).map(([name, value]) => ({ name, value })),
    );
  const query = (sql) => api("database/query", "POST", { query: sql });
  if (phase === "prepare") {
    const before = await api("config/auth");
    assertPreflight(before);
    const protectedNames = await api("secrets");
    if (!protectedNames.some((s) => s.name === "BREVO_API_KEY"))
      throw new Error(
        "Existing Brevo mail secret is missing; no authentication settings changed.",
      );
    const apiKeys = await api("api-keys?reveal=true");
    const authSecret = apiKeys.find((k) =>
      k.api_key?.startsWith("sb_secret_"),
    )?.api_key;
    if (!authSecret)
      throw new Error(
        "Existing secret API key is required for native per-client verification limits; no new API key or Auth settings created.",
      );
    const sql = await readFile(
      "supabase/migrations/20261008120000_stable_email_codes.sql",
      "utf8",
    );
    await query(sql);
    await query(
      `insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261008120000','stable_email_codes',array['${sql.replaceAll("'", "''")}']) on conflict(version) do nothing;`,
    );
    await query(`do $verify$ begin
      if to_regclass('private.stable_email_codes') is null or to_regclass('private.stable_email_code_limits') is null then raise exception 'Challenge storage missing'; end if;
      if not (select relrowsecurity from pg_class where oid='private.stable_email_codes'::regclass) then raise exception 'RLS missing'; end if;
      if has_table_privilege('anon','private.stable_email_codes','select') or has_table_privilege('authenticated','private.stable_email_codes','select') then raise exception 'Cache exposed'; end if;
      if has_function_privilege('anon','public.stable_email_code_send(text,text,text,text)','execute') or has_function_privilege('authenticated','public.stable_email_code_claim(text,text)','execute') or has_function_privilege('anon','public.stable_email_code_finish(text,uuid,boolean)','execute') then raise exception 'RPC exposed'; end if;
      if not has_function_privilege('service_role','public.stable_email_code_claim(text,text)','execute') then raise exception 'Service RPC unavailable'; end if;
    end $verify$;`);
    const key = randomBytes(32).toString("base64");
    const hookSecret = `v1,whsec_${randomBytes(32).toString("base64")}`;
    await secrets({
      STABLE_EMAIL_CODE_KEY: key,
      STABLE_EMAIL_HOOK_SECRET: hookSecret,
      STABLE_EMAIL_CODES_ENABLED: "false",
      STABLE_EMAIL_PUBLIC_ACTIVE: "false",
      STABLE_EMAIL_AUTH_SECRET_KEY: authSecret,
    });
    // Runner-local, mode 0600, never uploaded or printed. Keys are not checked in.
    await writeFile(
      statePath,
      JSON.stringify({
        key,
        hookSecret,
        beforeExpiry: before.mailer_otp_exp,
        beforeForwarding: before.security_sb_forwarded_for_enabled === true,
        fingerprint: unrelatedFingerprint(before),
      }),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      JSON.stringify({
        phase,
        project: PROJECT,
        scopedMigrationInstalled: true,
        privatePermissionsVerified: true,
        nativeMailUnchanged: true,
        migrationSha256: createHash("sha256").update(sql).digest("hex"),
      }),
    );
    return;
  }
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const before = await api("config/auth");
  assertPreflight(before);
  if (
    unrelatedFingerprint(before) !== state.fingerprint ||
    before.mailer_otp_exp !== state.beforeExpiry
  )
    throw new Error(
      "Auth configuration changed since preflight; no hook activation performed.",
    );
  let hookMayBeActive = false;
  try {
    await secrets({ STABLE_EMAIL_CODES_ENABLED: "true" });
    hookMayBeActive = true; // A timed-out PATCH can still have taken effect.
    await api("config/auth", "PATCH", activationPatch(state.hookSecret));
    const after = await api("config/auth");
    if (
      after.mailer_otp_exp !== 3600 ||
      after.hook_send_email_enabled !== true ||
      after.hook_send_email_uri !== HOOK_URI ||
      after.security_sb_forwarded_for_enabled !== true ||
      unrelatedFingerprint(after) !== state.fingerprint
    )
      throw new Error("Auth activation readback failed.");
    const testEmail = process.env.STABLE_EMAIL_TEST_ADDRESS;
    let testReceipt = { mailTest: "NOT_RUN" };
    // Management readback confirms persisted configuration, not propagation
    // to every running Auth instance. Drain the native resend window too.
    console.log(
      "Waiting for native Auth configuration propagation before controlled mail testing.",
    );
    for (let i = 0; i < 3; i++)
      await new Promise((resolve) => setTimeout(resolve, 30_000));
    if (testEmail)
      testReceipt = await verifyProduction(testEmail, state, query);
    await secrets({ STABLE_EMAIL_PUBLIC_ACTIVE: "true" });
    console.log(
      JSON.stringify({
        phase,
        project: PROJECT,
        expirySeconds: 3600,
        signedEmailHookEnabled: true,
        unrelatedAuthSettingsUnchanged: true,
        ...testReceipt,
      }),
    );
  } catch (error) {
    if (hookMayBeActive) {
      // Disable this feature only; never restore OAuth/other settings or remove data.
      await api("config/auth", "PATCH", {
        hook_send_email_enabled: false,
        mailer_otp_exp: state.beforeExpiry,
        security_sb_forwarded_for_enabled: state.beforeForwarding,
      });
      await secrets({
        STABLE_EMAIL_CODES_ENABLED: "false",
        STABLE_EMAIL_PUBLIC_ACTIVE: "false",
      });
      const restored = await api("config/auth");
      if (
        restored.hook_send_email_enabled !== false ||
        restored.mailer_otp_exp !== state.beforeExpiry
      )
        throw new Error(
          "Activation failed and rollback could not be verified; immediate operator attention required.",
        );
      console.error(
        "Stable-code activation failed; native mail and verifier fallback were restored.",
      );
    }
    throw error;
  }
}

async function verifyProduction(address, state, query) {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) throw new Error("Missing protected test configuration");
  const email = address.trim().toLowerCase();
  const base = `https://${PROJECT}.supabase.co`;
  const auth = async (path, body, bearer) =>
    fetch(`${base}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: anon,
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  const subject = createHmac("sha256", Buffer.from(state.key, "base64"))
    .update(`recovery:${email}`)
    .digest("hex");
  const read = async () => {
    const result = await query(
      `select code_cipher,hash_ciphers,expires_at,consumed from private.stable_email_codes where subject='${subject}';`,
    );
    if (result.length !== 1)
      throw new Error(
        "Test recovery request did not create exactly one cache record.",
      );
    return result[0];
  };
  if (
    !(
      await auth("recover?redirect_to=https%3A%2F%2Feconmind.group%2F", {
        email,
      })
    ).ok
  )
    throw new Error("First controlled test mail request failed.");
  const first = await read();
  // Native one-minute send limit is deliberately preserved. No request replay.
  await new Promise((resolve) => setTimeout(resolve, 65_000));
  if (
    !(
      await auth("recover?redirect_to=https%3A%2F%2Feconmind.group%2F", {
        email,
      })
    ).ok
  )
    throw new Error("Second controlled test mail request failed.");
  const second = await read();
  if (
    first.code_cipher !== second.code_cipher ||
    first.expires_at !== second.expires_at ||
    second.hash_ciphers.length < 2
  )
    throw new Error("Production resend changed the fixed code or expiry.");
  const [iv, cipher] = first.code_cipher.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(state.key, "base64"),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const code = new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(iv, "base64"),
        additionalData: new TextEncoder().encode(`${subject}:code`),
      },
      key,
      Buffer.from(cipher, "base64"),
    ),
  );
  const verify = (token) =>
    fetch(`${base}/functions/v1/verify-stable-email`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, token, purpose: "recovery" }),
      signal: AbortSignal.timeout(30_000),
    });
  const wrong = (code[0] === "0" ? "1" : "0") + code.slice(1);
  if ((await verify(wrong)).status !== 403)
    throw new Error("Wrong-code rejection failed.");
  const response = await verify(code);
  if (!response.ok) throw new Error("Original code failed after resend.");
  const { session } = await response.json();
  if (!session?.access_token || !session?.refresh_token)
    throw new Error("Native verified session missing.");
  try {
    if ((await verify(code)).status !== 403)
      throw new Error("One-time-use verification failed.");
  } finally {
    // Close only the session issued by this test. No password update, account
    // deletion, existing-session logout or admin role mutation occurs.
    if (!(await auth("logout?scope=local", {}, session.access_token)).ok)
      throw new Error("Test-session cleanup failed.");
  }
  return {
    mailTest: "PASS",
    twoProviderAcceptedEmails: true,
    unchangedCode: true,
    unchangedExpiry: true,
    originalCodeVerifiedAfterResend: true,
    singleUseVerified: true,
    testSessionClosed: true,
    passwordChanged: false,
    inboxDelivery: "NOT_INDEPENDENTLY_VERIFIED",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
