import test from "node:test";
import assert from "node:assert/strict";
import { createExportWorker } from "../worker.mjs";

test("worker records each result independently and finishes a leased job", async () => {
  const calls = [];
  const id = "00000000-0000-4000-8000-000000000001";
  const items = ["one", "two"].map(name => ({ id: name, number: `EML-CON-2026-${name}`, status: "issued", category: "CON", subtype: "Technical", issue_date: "2026-11-16", signature_key: "samuel_qian_v1", issuing_authority: "EconMind Founder Team", recipient: { name }, template: { title: "Contribution" } }));
  const fakeFetch = async (url, options) => {
    const body = options.body && typeof options.body === "string" ? JSON.parse(options.body) : null;
    calls.push({ path: url.pathname, body });
    if (url.pathname.endsWith("claim_credential_export")) return Response.json({ id, batch_id: id, claim_token: id, items });
    if (url.pathname.includes("/storage/")) return Response.json({ ok: true });
    return Response.json(null);
  };
  const render = async options => { if (options.fields.name === "one") throw new Error("Render failed"); return Buffer.from("%PDF-test"); };
  const worker = createExportWorker({ supabaseUrl: "https://example.supabase.co/", serviceKey: "secret", templatePath: "private", yaleSignaturePath: "private" }, { fetch: fakeFetch, render, verifyBaseline: async () => {} });
  assert.equal(await worker.runOnce(), true);
  const records = calls.filter(call => call.path.endsWith("record_credential_export_item"));
  assert.equal(records.length, 2);
  assert.equal(records[0].body.p_failure, "PDF generation or storage failed.");
  assert.equal(records[0].body.p_path, null);
  assert.equal(records[1].body.p_path, `${id}/two.pdf`);
  assert.equal(records[1].body.p_failure, null);
  assert.equal(calls.filter(call => call.path.endsWith("finish_credential_export")).length, 1);
});

test("verification records overflow for one entry without certifying the batch itself", async () => {
  const calls = [];
  const id = "00000000-0000-4000-8000-000000000001";
  const job = { id, batch_id: id, claim_token: id, category: "CON", subtype: "Technical", issue_date: "2026-11-16", signature_key: "yale_chen_v1", issuing_authority: "EconMind Founder Team", template: { title: "Contribution" }, items: [{ index: 0, recipient: { name: "First" } }, { index: 1, recipient: { name: "Second" } }] };
  const fakeFetch = async (url, options) => {
    const body = typeof options.body === "string" ? JSON.parse(options.body) : null;
    calls.push({ path: url.pathname, body });
    return Response.json(url.pathname.endsWith("claim_credential_verification") ? job : null);
  };
  const render = async options => { if (options.fields.name === "Second") throw new Error("Text exceeds the approved certificate layout: .award-name"); return Buffer.from("png"); };
  const worker = createExportWorker({ supabaseUrl: "https://example.supabase.co/", serviceKey: "secret", templatePath: "private", yaleSignaturePath: "private" }, { fetch: fakeFetch, render, verifyBaseline: async () => {} });
  assert.equal(await worker.runOnce(), true);
  const records = calls.filter(call => call.path.endsWith("record_credential_verification_item"));
  assert.equal(records.length, 2);
  assert.equal(records[0].body.p_failure, null);
  assert.match(records[1].body.p_failure, /Text exceeds/);
  assert.equal(calls.some(call => call.path.endsWith("finish_credential_verification")), true);
  assert.equal(calls.some(call => call.path.endsWith("attest_credential_preview")), false);
});

test("a retry can acknowledge an already uploaded private PDF after a worker crash", async () => {
  const id = "00000000-0000-4000-8000-000000000001"; const calls = [];
  const item = { id, number: "EML-CON-2026-000001", status: "issued", category: "CON", subtype: "Technical", issue_date: "2026-11-16", signature_key: "samuel_qian_v1", issuing_authority: "EconMind Founder Team", recipient: { name: "Test" }, template: { title: "Contribution" } };
  const fakeFetch = async (url, options) => {
    calls.push({ path: url.pathname, body: typeof options.body === "string" ? JSON.parse(options.body) : null });
    if (url.pathname.endsWith("claim_credential_verification")) return Response.json(null);
    if (url.pathname.endsWith("claim_credential_export")) return Response.json({ id, batch_id: id, claim_token: id, items: [item] });
    if (url.pathname.startsWith("/storage/v1/object/authenticated/")) return new Response(Buffer.from("%PDF-" + "x".repeat(120)));
    if (url.pathname.startsWith("/storage/")) return new Response("{}", { status: 409 });
    return Response.json(null);
  };
  const worker = createExportWorker({ supabaseUrl: "https://example.supabase.co/", serviceKey: "secret", templatePath: "private", yaleSignaturePath: "private" }, { fetch: fakeFetch, render: async () => Buffer.from("%PDF-new"), verifyBaseline: async () => {} });
  assert.equal(await worker.runOnce(), true);
  const record = calls.find(call => call.path.endsWith("record_credential_export_item"));
  assert.equal(record.body.p_path, `${id}/${id}.pdf`);
  assert.equal(record.body.p_failure, null);
});

test("a mismatched visual baseline prevents the worker from claiming jobs", async () => {
  let called = false;
  const worker = createExportWorker({ supabaseUrl: "https://example.supabase.co/", serviceKey: "secret", templatePath: "private", yaleSignaturePath: "private" }, { fetch: async () => { called = true; return Response.json(null); }, verifyBaseline: async () => { throw new Error("Baseline mismatch"); } });
  await assert.rejects(worker.runOnce(), /Baseline mismatch/);
  assert.equal(called, false);
});

test("background verification and export render the real private template", { skip: !process.env.ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE || !process.env.ECONMIND_PRIVATE_YALE_SIGNATURE }, async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const recipient = { name: "Jane Doe", role: "Developer", department: "Technology", contribution: "For contributing to EconMind League." };
  const common = { id, batch_id: id, claim_token: id, category: "CON", subtype: "Technical", issue_date: "2026-11-16", signature_key: "yale_chen_v1", issuing_authority: "EconMind Founder Team", template: { title: "Contribution" } };
  let verificationClaimed = false; let exportClaimed = false; const records = [];
  const fakeFetch = async (url, options) => {
    const path = url.pathname;
    if (path.endsWith("claim_credential_verification")) { if (verificationClaimed) return Response.json(null); verificationClaimed = true; return Response.json({ ...common, items: [{ index: 0, recipient }] }); }
    if (path.endsWith("claim_credential_export")) { if (exportClaimed) return Response.json(null); exportClaimed = true; return Response.json({ ...common, items: [{ ...common, id, number: "EML-CON-2026-000001", status: "issued", recipient }] }); }
    if (path.includes("/storage/v1/object/")) { assert.equal(Buffer.from(options.body).subarray(0, 5).toString(), "%PDF-"); return Response.json({ ok: true }); }
    if (path.includes("record_credential_")) records.push(JSON.parse(options.body));
    return Response.json(null);
  };
  const worker = createExportWorker({ supabaseUrl: "https://example.supabase.co/", serviceKey: "secret", templatePath: process.env.ECONMIND_PRIVATE_CERTIFICATE_TEMPLATE, yaleSignaturePath: process.env.ECONMIND_PRIVATE_YALE_SIGNATURE }, { fetch: fakeFetch });
  assert.equal(await worker.runOnce(), true);
  assert.equal(await worker.runOnce(), true);
  assert.equal(records.length, 2);
  assert.equal(records[0].p_failure, null);
  assert.equal(records[1].p_failure, null);
  assert.equal(records[1].p_path, `${id}/${id}.pdf`);
});
