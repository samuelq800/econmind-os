import test from "node:test";
import assert from "node:assert/strict";
import { createCredentialService } from "../service.mjs";

const user = "00000000-0000-4000-8000-000000000001";
const batchId = "00000000-0000-4000-8000-000000000002";
const credentialId = "00000000-0000-4000-8000-000000000003";
const config = { supabaseUrl: "https://example.supabase.co/", anonKey: "anon-key", serviceKey: "service-key", allowedOrigin: "https://econmind.group", templatePath: "private-template", yaleSignaturePath: "private-signature" };

test("preview and PDF require a verified administrator and never expose the service key", async () => {
  let status = "reviewed"; let credentialStatus = "issued"; const calls = []; const renders = [];
  const batch = () => ({ id: batchId, status, signature_key: "yale_chen_v1", category: "CON", subtype: "Technical", template: { title: "CONTRIBUTION" }, issue_date: "2026-11-16", issuing_authority: "EconMind Founder Team", entries: [{ name: "Example", role: "Developer" }], credentials: [{ id: credentialId, status: credentialStatus, certificate_number: "EML-CON-2026-000001", recipient_snapshot: { name: "Example", role: "Developer" } }] });
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
  const server = createCredentialService(config, { fetch: fakeFetch, render, verifyBaseline: async () => {} });
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
    assert.equal((await post("/verify", "valid", { batchId })).status, 404);
    status = "issued";
    const pdf = await post("/pdf", "valid", { batchId, credentialId });
    assert.equal(pdf.status, 200); assert.equal(await pdf.text(), "pdf");
    assert.equal(renders.at(-1).fields.certificateId, "EML-CON-2026-000001");
    assert.notEqual(pdf.headers.get("authorization"), "Bearer service-key");
    credentialStatus = "revoked";
    assert.equal((await post("/pdf", "valid", { batchId, credentialId })).status, 404);
    assert.equal((await post("/view", "valid", { batchId, credentialId })).status, 200);
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

test("ZIP streaming checks authorization and includes only active completed credentials", async () => {
  const jobId = "00000000-0000-4000-8000-000000000004";
  const manifest = { id: jobId, batch_id: batchId, state: "complete", items: [{ credential_id: credentialId, number: "EML-CON-2026-000001", storage_path: `${batchId}/${credentialId}.pdf` }] };
  const fakeFetch = async url => {
    if (url.pathname === "/auth/v1/user") return Response.json({ id: user });
    if (url.pathname.endsWith("get_credential_export_downloads")) return Response.json(manifest);
    if (url.pathname.startsWith("/storage/v1/object/authenticated/")) return new Response("%PDF-synthetic-test");
    throw new Error("Unexpected backend call");
  };
  const server = createCredentialService(config, { fetch: fakeFetch });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/zip`, { method: "POST", headers: { authorization: "Bearer valid", "content-type": "application/json", origin: config.allowedOrigin }, body: JSON.stringify({ jobId }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/zip");
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
    assert.equal(bytes.includes(Buffer.from("EML-CON-2026-000001.pdf")), true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
