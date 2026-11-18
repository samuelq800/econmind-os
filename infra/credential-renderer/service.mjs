import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { renderCertificate, verifyVisualEnvironment } from "./render.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = { MEM: "MEMBERSHIP", PAR: "PARTICIPATION", CON: "CONTRIBUTION", LEA: "LEADERSHIP", DIS: "DISTINCTION", SUP: "SUPERVISOR", CLB: "SCHOOL ECON / BUSINESS CLUB", PRT: "PARTNER", GSP: "GUEST SPEAKER" };

const NUMBER = /^EML-(MEM|PAR|CON|LEA|DIS|SUP|CLB|PRT|GSP)-\d{4}-\d{6}$/;

export function fieldsFor(batch, entry, number, preview) {
  const year = Number(batch.issue_date.slice(0, 4));
  const issueDate = new Date(`${batch.issue_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return {
    name: entry.name, role: entry.role || batch.template.role_description || "", description: [batch.template.certification_statement || "", entry.contribution || batch.template.contribution_paragraph || "", entry.service_period ? `Service period: ${entry.service_period}.` : batch.template.service_period_text || ""].filter(Boolean).join(" "),
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
  const verifyBaseline = dependencies.verifyBaseline || verifyVisualEnvironment;
  let baselinePromise;
  const ensureBaseline = () => baselinePromise ||= verifyBaseline(config.templatePath).catch(error => { baselinePromise = null; throw error; });
  const base = new URL(config.supabaseUrl);
  if (base.protocol !== "https:" || base.pathname !== "/") throw new Error("Invalid Supabase URL.");
  if (!config.anonKey || !config.allowedOrigin || !config.templatePath || !config.yaleSignaturePath) throw new Error("Missing private renderer configuration.");
  let activeRequests = 0;

  async function call(path, token, key, body) {
    const response = await request(new URL(path, base), { method: body === undefined ? "GET" : "POST", headers: { apikey: key, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
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
      if (req.method !== "POST" || !["/preview", "/view", "/pdf", "/zip", "/batch-zip"].includes(req.url)) { send(404, "application/json", '{}'); return; }
      const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || "")?.[1];
      if (!token) { send(403, "application/json", '{"error":"Authentication required"}'); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 4096) throw Object.assign(new Error("Request too large."), { status: 413 }); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (req.url === "/zip" ? !UUID.test(body.jobId || "") : !UUID.test(body.batchId || "") || (body.credentialId && !UUID.test(body.credentialId))) throw Object.assign(new Error("Invalid request."), { status: 400 });
      const userId = await actor(token);
      if (req.url === "/zip") {
        if (!config.serviceKey) { send(404, "application/json", "{}"); return; }
        const manifest = await call("/rest/v1/rpc/get_credential_export_downloads", token, config.anonKey, { p_job_id: body.jobId });
        if (!Array.isArray(manifest.items) || !manifest.items.length || manifest.items.length > 500) throw Object.assign(new Error("No completed certificates available."), { status: 400 });
        const archive = new ZipArchive({ zlib: { level: 6 } });
        archive.on("error", error => res.destroy(error));
        res.writeHead(200, { ...cors, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="EconMind_Credentials_${body.jobId}.zip"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        archive.pipe(res);
        for (const item of manifest.items) {
          if (!UUID.test(item.credential_id) || item.storage_path !== `${manifest.batch_id}/${item.credential_id}.pdf` || !NUMBER.test(item.number)) throw new Error("Invalid export manifest.");
          if (await actor(token) !== userId) throw new Error("Session changed.");
          const current = await call("/rest/v1/rpc/get_credential_export_downloads", token, config.anonKey, { p_job_id: body.jobId });
          if (!current.items.some(row => row.credential_id === item.credential_id && row.storage_path === item.storage_path)) throw new Error("Credential is no longer available.");
          const file = await request(new URL(`/storage/v1/object/authenticated/credential-pdfs/${item.storage_path}`, base), { headers: { apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}` }, signal: AbortSignal.timeout(90000) });
          if (!file.ok || !file.body || Number(file.headers.get("content-length") || 0) > 26214400) throw new Error("Private export file unavailable.");
          const entryFinished = new Promise((resolve, reject) => {
            const cleanup = () => { archive.off("entry", onEntry); archive.off("error", onError); res.off("close", onClose); };
            const onEntry = () => { cleanup(); resolve(); };
            const onError = error => { cleanup(); reject(error); };
            const onClose = () => { cleanup(); archive.abort(); reject(new Error("Download interrupted.")); };
            archive.once("entry", onEntry); archive.once("error", onError); res.once("close", onClose);
          });
          archive.append(Readable.fromWeb(file.body), { name: `${item.number}.pdf` });
          await entryFinished;
        }
        await archive.finalize();
        return;
      }
      const batch = await batchData(token, body.batchId, body.credentialId || null);
      if (req.url === "/batch-zip") {
        const records = batch.credentials?.filter(row => row.status === "issued") ?? [];
        if (batch.status !== "issued" || !records.length || records.length > 500 ||
          records.some(row => !NUMBER.test(row.certificate_number))) {
          send(404, "application/json", '{"error":"No active issued certificates found."}'); return;
        }
        await ensureBaseline();
        const files = [];
        let totalBytes = 0;
        for (const record of records) {
          if (res.destroyed) return;
          const template = record.template_snapshot?.text_content ?? batch.template;
          const bytes = await render({
            templatePath: config.templatePath, yaleSignaturePath: config.yaleSignaturePath, signatureKey: batch.signature_key,
            fields: fieldsFor({ ...batch, template }, record.recipient_snapshot, record.certificate_number, false), output: "pdf",
          });
          totalBytes += bytes.length;
          if (totalBytes > 128 * 1024 * 1024) {
            send(413, "application/json", '{"error":"Batch exceeds the download size limit."}'); return;
          }
          files.push({ bytes, name: `${record.certificate_number}.pdf` });
        }
        if (await actor(token) !== userId) { send(403, "application/json", "{}"); return; }
        const latest = await batchData(token, body.batchId);
        const active = new Set(latest.credentials.filter(row => row.status === "issued").map(row => row.id));
        if (records.some(row => !active.has(row.id))) {
          send(409, "application/json", '{"error":"A certificate changed during export. Retry the download."}'); return;
        }
        if (res.destroyed) return;
        const archive = new ZipArchive({ zlib: { level: 1 } });
        archive.on("error", error => res.destroy(error));
        res.on("close", () => archive.abort());
        res.writeHead(200, { ...cors, "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="EconMind_Credentials_${body.batchId}.zip"`,
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        archive.pipe(res);
        for (const file of files) archive.append(file.bytes, { name: file.name });
        await archive.finalize();
        return;
      }
      const options = { templatePath: config.templatePath, signatureKey: batch.signature_key, yaleSignaturePath: config.yaleSignaturePath };
      await ensureBaseline();
      if (req.url === "/preview") {
        if (!Number.isSafeInteger(body.index) || body.index < 0 || body.index >= batch.entries.length) throw Object.assign(new Error("Invalid entry."), { status: 400 });
        const png = await render({ ...options, fields: fieldsFor(batch, batch.entries[body.index], null, true), output: "png" });
        if (await actor(token) !== userId) throw Object.assign(new Error("Session changed."), { status: 403 });
        await batchData(token, body.batchId);
        send(200, "image/png", png); return;
      }
      const credential = batch.credentials.find(row => row.id === body.credentialId);
      if (!credential || (req.url === "/pdf" && credential.status !== "issued") || batch.status !== "issued") throw Object.assign(new Error("Issued credential not found."), { status: 404 });
      const output = req.url === "/view" ? "png" : "pdf";
      const file = await render({ ...options, fields: fieldsFor({ ...batch, template: credential.template_snapshot?.text_content ?? batch.template }, credential.recipient_snapshot, credential.certificate_number, false), output });
      if (await actor(token) !== userId) throw Object.assign(new Error("Session changed."), { status: 403 });
      const latest = await batchData(token, body.batchId, body.credentialId);
      if (!latest.credentials.some(row => row.id === body.credentialId && (req.url === "/view" || row.status === "issued"))) throw Object.assign(new Error("Credential is no longer available."), { status: 403 });
      send(200, output === "png" ? "image/png" : "application/pdf", file);
    } catch (error) {
      const status = error?.status || 400;
      const message = error instanceof Error && error.message.startsWith("Text exceeds") ? error.message : "Unable to complete the request.";
      if (res.headersSent) res.destroy(); else send(status, "application/json", JSON.stringify({ error: message }));
    } finally { activeRequests -= 1; }
  }
  return createServer((req, res) => { void handle(req, res); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCredentialService({ supabaseUrl: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, allowedOrigin: process.env.CREDENTIAL_ALLOWED_ORIGIN, templatePath: process.env.CREDENTIAL_PRIVATE_TEMPLATE, yaleSignaturePath: process.env.CREDENTIAL_PRIVATE_YALE_SIGNATURE });
  server.listen(Number(process.env.PORT || 8080), process.env.HOST || "127.0.0.1", () => console.log("Credential renderer listening"));
}
