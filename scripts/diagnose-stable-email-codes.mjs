// Read-only, one owner-authorized mailbox, one approved project. No OTP/key/session output.
const project = "vimksjrhaxdpnkvgsavz";
const email = process.env.OTP_DIAGNOSTIC_EMAIL?.trim().toLowerCase();
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !token ||
  process.env.SUPABASE_PROJECT_REF !== project
)
  throw new Error("Approved diagnostic scope is required");
async function api(path, body) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${project}/${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`Read-only diagnostic failed: HTTP ${response.status}`);
  return response.json();
}
const config = await api("config/auth");
const rows = await api("database/query", {
  query: `select count(*)::int as matching_accounts,coalesce(bool_or(email_confirmed_at is not null),false) as email_confirmed,coalesce(bool_or(banned_until>now()),false) as currently_banned,coalesce(bool_or(deleted_at is not null),false) as deleted from auth.users where lower(email)='${email.replaceAll("'", "''")}';`,
});
const counts = await api("database/query", {
  query: `select count(*)::int as recent_hook_records from private.stable_email_codes where issued_at>now()-interval '1 hour';`,
});
console.log(
  JSON.stringify({
    project,
    nativeExpirySeconds: config.mailer_otp_exp,
    hookEnabled: config.hook_send_email_enabled === true,
    ipForwardingEnabled: config.security_sb_forwarded_for_enabled === true,
    mailbox: rows[0],
    cache: counts[0],
  }),
);
