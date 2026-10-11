import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { provePendingRegistrationPassword } from "../supabase/functions/_shared/group-registration.ts";

// Only a disposable local GoTrue instance. Never use a linked Supabase project.
const base = process.env.LOCAL_AUTH_URL || "http://127.0.0.1:54844";
const parsed = new URL(base);
assert.equal(parsed.protocol, "http:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
const secret = process.env.LOCAL_AUTH_JWT_SECRET;
assert.ok(secret, "Disposable local JWT secret required");
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role: "service_role", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 })}`;
const token = `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
async function request(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, data: await response.json() };
}
const email = `group-${randomUUID()}@example.test`;
const password = `Original-${randomUUID()}`;
let id;
try {
  const created = await request("/admin/users", "POST", {
    email,
    password,
    email_confirm: false,
    app_metadata: { retained: "original" },
  });
  assert.equal(created.status, 200);
  id = created.data.id;
  assert.ok(id);
  assert.ok(!created.data.email_confirmed_at);
  const fetcher = (url, options) =>
    fetch(String(url).replace("/auth/v1/", "/"), options);
  assert.equal(
    await provePendingRegistrationPassword(
      base,
      token,
      email,
      "Wrong-password-2026",
      async () => {},
      fetcher,
    ),
    false,
  );
  assert.equal(
    await provePendingRegistrationPassword(
      base,
      token,
      email,
      password,
      async () => {},
      fetcher,
    ),
    true,
  );
  const activated = await request(`/admin/users/${id}`, "PUT", {
    email_confirm: true,
    app_metadata: {
      ...created.data.app_metadata,
      group_registration: { email_ownership_verified: false },
    },
  });
  assert.equal(activated.status, 200);
  assert.ok(activated.data.email_confirmed_at);
  assert.equal(activated.data.app_metadata.retained, "original");
  assert.equal(
    (
      await request("/token?grant_type=password", "POST", {
        email,
        password: "Wrong-password-2026",
      })
    ).status,
    400,
  );
  const signed = await request("/token?grant_type=password", "POST", {
    email,
    password,
  });
  assert.equal(signed.status, 200);
  assert.equal(signed.data.user.id, id);
  let closed = false;
  assert.equal(
    await provePendingRegistrationPassword(
      base,
      token,
      email,
      password,
      async (accessToken) => {
        const response = await fetch(`${base}/logout?scope=local`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        assert.equal(response.status, 204);
        closed = true;
      },
      fetcher,
    ),
    false,
  );
  assert.equal(closed, true);
  console.log(
    "PASS: native pending-password proof, activation, preserved password/metadata, and concurrent-session cleanup",
  );
} finally {
  if (id)
    assert.equal(
      (await request(`/admin/users/${id}`, "DELETE", {})).status,
      200,
    );
}
