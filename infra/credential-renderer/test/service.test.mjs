import test from "node:test";
import assert from "node:assert/strict";
import { createCredentialService } from "../service.mjs";

const user = "00000000-0000-4000-8000-000000000001";
const batchId = "00000000-0000-4000-8000-000000000002";
const credentialId = "00000000-0000-4000-8000-000000000003";
const config = { supabaseUrl: "https://example.supabase.co/", anonKey: "anon-key", serviceKey: "service-key", allowedOrigin: "https://econmind.group", templatePath: "private-template", yaleSignaturePath: "private-signature" };

test("preview, attestation and PDF require a verified administrator and never expose the service key", async () => {
  let status = "reviewed"; const calls = []; const renders = [];
  const batch = () => ({ id: batchId, status, signature_key: "yale_chen_v1", category: "CON", subtype: "Technical", template: { title: "CONTRIBUTION" }, issue_date: "2026-11-16", issuing_authority: "EconMind Founder Team", entries: [{ name: "Example", role: "Developer" }], credentials: [{ id: credentialId, status: "issued", certificate_number: "EML-CON-2026-000001", recipient_snapshot: { name: "Example", role: "Developer" } }] });
  const fakeFetch = async (url, options) => {
    calls.push({ path: url.pathname, token: options.headers.authorization });
    if (options.headers.authorization === "Bearer invalid") return new Response("{}", { status: 401 });
    if (url.pathname === "/auth/v1/user") return Response.json({ id: user });
    if (options.headers.authorization === "Bearer other-admin") return new Response("{}", { status: 403 });
    if (url.pathname.endsWith("get_credential_render_data")) return Response.json(batch());
    if (url.pathname.endsWith("attest_credential_preview")) return Response.json(null);
    throw new Error("Unexpected backend call");
  };
  const render = async options => { renders.push(options); return Buffer.from(options.output); };
  const server = createCredentialService(config, { fetch: fakeFetch, render });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = `http://127.0.0.1:${server.address().port}`;
    const post = (path, token, data, origin = config.allowedOrigin) => fetch(address + path, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", origin }, body: JSON.stringify(data) });
    assert.equal((await post("/preview", "invalid", { batchId, index: 0 })).status, 403);
    assert.equal((await post("/preview", "other-admin", { batchId, index: 0 })).status, 403);
    assert.equal(renders.length, 0);
    assert.equal((await post("/preview", "valid", { batchId, index: 0 }, "https://untrusted.example")).status, 403);
    const preview = await post("/preview", "valid", { batchId, index: 0 });
    assert.equal(preview.status, 200); assert.equal(await preview.text(), "png");
    assert.equal(renders[0].signatureKey, "yale_chen_v1");
    const verified = await post("/verify", "valid", { batchId });
    assert.deepEqual(await verified.json(), { verified: 1 });
    assert.equal(calls.filter(call => call.path.endsWith("attest_credential_preview")).length, 1);
    status = "issued";
    const pdf = await post("/pdf", "valid", { batchId, credentialId });
    assert.equal(pdf.status, 200); assert.equal(await pdf.text(), "pdf");
    assert.equal(renders.at(-1).fields.certificateId, "EML-CON-2026-000001");
    assert.notEqual(pdf.headers.get("authorization"), "Bearer service-key");
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test("a real private template renders the selected signature through the authenticated service", { skip: !process.env.ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE || !process.env.ECONMIND_PRIVATE_YALE_SIGNATURE }, async () => {
  const conf = { ...config, templatePath: process.env.ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE, yaleSignaturePath: process.env.ECONMIND_PRIVATE_YALE_SIGNATURE };
  const fakeFetch = async url => url.pathname === "/auth/v1/user" ? Response.json({ id: user }) : Response.json({ id: batchId, status: "draft", signature_key: "yale_chen_v1", category: "CON", subtype: "Technical", template: { title: "CONTRIBUTION" }, issue_date: "2026-11-16", issuing_authority: "EconMind Founder Team", entries: [{ name: "Jane Doe", role: "Developer", department: "Technology", contribution: "For contributing to EconMind League." }], credentials: [] });
  const server = createCredentialService(conf, { fetch: fakeFetch });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/preview`, { method: "POST", headers: { authorization: "Bearer valid", "content-type": "application/json", origin: conf.allowedOrigin }, body: JSON.stringify({ batchId, index: 0 }) });
    if (response.status !== 200) assert.fail(`Preview failed: ${response.status} ${await response.text()}`);
    assert.equal(response.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137,80,78,71,13,10,26,10]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
