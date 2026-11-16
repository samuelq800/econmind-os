import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { renderCertificate } from "./render.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = { MEM: "MEMBERSHIP", PAR: "PARTICIPATION", CON: "CONTRIBUTION", LEA: "LEADERSHIP", DIS: "DISTINCTION" };

function fieldsFor(batch, entry, number, preview) {
  const year = Number(batch.issue_date.slice(0, 4));
  const issueDate = new Date(`${batch.issue_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return {
    name: entry.name, role: entry.role || "", description: [entry.contribution || batch.template.contribution_paragraph || "", entry.service_period ? `Service period: ${entry.service_period}.` : ""].filter(Boolean).join(" "),
    kicker: `EconMind League · ${batch.subtype}`,
    titleMain: batch.template.title || CATEGORIES[batch.category], titleGold: "", titleSub: "",
    scope1: entry.department || "", scope2: entry.project || "", scope3: entry.role || "",
    issueDate, certificateId: number || `EML-${batch.category}-${year}-999999`, authority: batch.issuing_authority,
    specimen: preview ? "Preview · Not an issued credential" : "",
  };
}

/** This process must run behind TLS. Signature and service keys stay server-side. */
export function createCredentialService(config, dependencies = {}) {
  const request = dependencies.fetch || fetch;
  const render = dependencies.render || renderCertificate;
  const base = new URL(config.supabaseUrl);
  if (base.protocol !== "https:" || base.pathname !== "/") throw new Error("Invalid Supabase URL.");
  if (!config.anonKey || !config.serviceKey || !config.allowedOrigin || !config.templatePath || !config.yaleSignaturePath) throw new Error("Missing private renderer configuration.");
  let activeRequests = 0;

  async function call(path, token, key, body) {
    const response = await request(new URL(path, base), { method: body === undefined ? "GET" : "POST", headers: { apikey: key, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw Object.assign(new Error("Administrator access or operation denied."), { status: response.status === 401 || response.status === 403 ? 403 : 400 });
    return response.status === 204 ? null : response.json();
  }
  async function actor(token) {
    const user = await call("/auth/v1/user", token, config.anonKey);
    if (!user || !UUID.test(user.id)) throw Object.assign(new Error("Administrator authentication required."), { status: 403 });
    return user.id;
  }
  async function batchData(token, batchId, credentialId = null) {
    return call("/rest/v1/rpc/get_credential_render_data", token, config.anonKey, { p_batch_id: batchId, p_credential_id: credentialId });
  }
  async function handle(req, res) {
    const origin = req.headers.origin;
    if (origin && origin !== config.allowedOrigin) { res.writeHead(403).end(); return; }
    const cors = origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    if (req.method === "OPTIONS") { res.writeHead(204, { ...cors, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }).end(); return; }
    const send = (status, type, bytes) => { res.writeHead(status, { ...cors, "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(bytes); };
    if (activeRequests >= 2) { send(429, "application/json", '{"error":"Renderer is busy. Please retry."}'); return; }
    activeRequests += 1;
    try {
      if (req.method !== "POST" || !["/preview", "/verify", "/pdf"].includes(req.url)) { send(404, "application/json", '{}'); return; }
      const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "")?.[1];
      if (!token) { send(403, "application/json", '{"error":"Authentication required"}'); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 4096) throw Object.assign(new Error("Request too large."), { status: 413 }); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!UUID.test(body.batchId || "") || (body.credentialId && !UUID.test(body.credentialId))) throw Object.assign(new Error("Invalid request."), { status: 400 });
      const userId = await actor(token);
      const batch = await batchData(token, body.batchId, body.credentialId || null);
      const options = { templatePath: config.templatePath, signatureKey: batch.signature_key, yaleSignaturePath: config.yaleSignaturePath };
      if (req.url === "/preview") {
        if (!Number.isSafeInteger(body.index) || body.index < 0 || body.index >= batch.entries.length) throw Object.assign(new Error("Invalid entry."), { status: 400 });
        const png = await render({ ...options, fields: fieldsFor(batch, batch.entries[body.index], null, true), output: "png" });
        if (await actor(token) !== userId) throw Object.assign(new Error("Session changed."), { status: 403 });
        await batchData(token, body.batchId);
        send(200, "image/png", png); return;
      }
      if (req.url === "/verify") {
        if (batch.status !== "reviewed") throw Object.assign(new Error("Batch must first be reviewed."), { status: 400 });
        for (const entry of batch.entries) await render({ ...options, fields: fieldsFor(batch, entry, null, true), output: "png" });
        // Recheck the session and its role immediately before the privileged
        // attestation; the database independently rechecks the actor's status.
        if (await actor(token) !== userId) throw Object.assign(new Error("Session changed."), { status: 403 });
        await batchData(token, body.batchId);
        await call("/rest/v1/rpc/attest_credential_preview", config.serviceKey, config.serviceKey, { p_batch_id: body.batchId, p_actor: userId });
        send(200, "application/json", JSON.stringify({ verified: batch.entries.length })); return;
      }
      const credential = batch.credentials.find(row => row.id === body.credentialId);
      if (!credential || credential.status !== "issued" || batch.status !== "issued") throw Object.assign(new Error("Issued credential not found."), { status: 404 });
      const pdf = await render({ ...options, fields: fieldsFor(batch, credential.recipient_snapshot, credential.certificate_number, false), output: "pdf" });
      if (await actor(token) !== userId) throw Object.assign(new Error("Session changed."), { status: 403 });
      const latest = await batchData(token, body.batchId, body.credentialId);
      if (!latest.credentials.some(row => row.id === body.credentialId && row.status === "issued")) throw Object.assign(new Error("Credential is no longer available."), { status: 403 });
      send(200, "application/pdf", pdf);
    } catch (error) {
      const status = error?.status || 400;
      const message = error instanceof Error && error.message.startsWith("Text exceeds") ? error.message : "Unable to complete the request.";
      send(status, "application/json", JSON.stringify({ error: message }));
    } finally { activeRequests -= 1; }
  }
  return createServer((req, res) => { void handle(req, res); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCredentialService({ supabaseUrl: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, allowedOrigin: process.env.CREDENTIAL_ALLOWED_ORIGIN, templatePath: process.env.CREDENTIAL_PRIVATE_TEMPLATE, yaleSignaturePath: process.env.CREDENTIAL_PRIVATE_YALE_SIGNATURE });
  server.listen(Number(process.env.PORT || 8080), process.env.HOST || "127.0.0.1", () => console.log("Credential renderer listening"));
}
