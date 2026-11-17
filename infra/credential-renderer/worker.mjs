import { pathToFileURL } from "node:url";
import { renderCertificate, verifyVisualEnvironment } from "./render.mjs";
import { fieldsFor } from "./service.mjs";

/** Single-claim worker. PostgreSQL leases coordinate multiple worker instances. */
export function createExportWorker(config, dependencies = {}) {
  const request = dependencies.fetch || fetch;
  const render = dependencies.render || renderCertificate;
  const verifyBaseline = dependencies.verifyBaseline || verifyVisualEnvironment;
  let baselinePromise;
  const base = new URL(config.supabaseUrl);
  if (base.protocol !== "https:" || base.pathname !== "/" || !config.serviceKey || !config.templatePath || !config.yaleSignaturePath) throw new Error("Missing or invalid export worker configuration.");
  const headers = { apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}` };
  async function rpc(name, body = {}) {
    const response = await request(new URL(`/rest/v1/rpc/${name}`, base), { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Export operation ${name} failed (${response.status}).`);
    return response.status === 204 ? null : response.json();
  }
  async function storePdf(path, pdf) {
    const url = new URL(`/storage/v1/object/credential-pdfs/${path}`, base);
    if (pdf.length > 26214400) throw new Error("PDF exceeds the private bucket size limit.");
    const response = await request(url, { method: "POST", headers: { ...headers, "content-type": "application/pdf", "x-upsert": "false" }, body: pdf, signal: AbortSignal.timeout(90000) });
    if (response.ok) return;
    // A worker can crash after an atomic upload but before acknowledging it.
    // The path is derived from an immutable credential UUID and is writable
    // only by the service. Verify the existing object before acknowledging it.
    if (response.status === 409 || response.status === 400) {
      const existing = await request(new URL(`/storage/v1/object/authenticated/credential-pdfs/${path}`, base), { headers, signal: AbortSignal.timeout(90000) });
      if (existing.ok && existing.body && Number(existing.headers.get("content-length") || 0) <= 26214400) {
        const chunks = []; let size = 0;
        for await (const chunk of existing.body) { size += chunk.length; if (size > 26214400) throw new Error("Stored PDF exceeds the size limit."); chunks.push(chunk); }
        const bytes = Buffer.concat(chunks);
        if (bytes.length > 100 && bytes.subarray(0, 5).toString() === "%PDF-") return;
      }
    }
    throw new Error("Private PDF storage failed.");
  }
  async function runOnce() {
    baselinePromise ||= verifyBaseline(config.templatePath).catch(error => { baselinePromise = null; throw error; });
    await baselinePromise;
    const verification = await rpc("claim_credential_verification");
    if (verification) {
      let leaseLost = false;
      const lease = { p_job_id: verification.id, p_token: verification.claim_token };
      const timer = setInterval(() => { void rpc("heartbeat_credential_verification", lease).catch(() => { leaseLost = true; }); }, 25000);
      try {
        for (const item of verification.items) {
          if (leaseLost) throw new Error("Verification claim expired.");
          let failure = null;
          try {
            await render({ templatePath: config.templatePath, yaleSignaturePath: config.yaleSignaturePath, signatureKey: verification.signature_key, fields: fieldsFor(verification, item.recipient, null, true), output: "png" });
          } catch (error) {
            failure = error instanceof Error && error.message.startsWith("Text exceeds") ? error.message.slice(0, 500) : "Preview could not be generated.";
          }
          if (leaseLost) throw new Error("Verification claim expired.");
          await rpc("record_credential_verification_item", { ...lease, p_index: item.index, p_failure: failure });
        }
        if (leaseLost) throw new Error("Verification claim expired.");
        await rpc("finish_credential_verification", lease);
        return true;
      } finally { clearInterval(timer); }
    }
    const job = await rpc("claim_credential_export");
    if (!job) return false;
    let leaseLost = false;
    const lease = { p_job_id: job.id, p_token: job.claim_token };
    const timer = setInterval(() => { void rpc("heartbeat_credential_export", lease).catch(() => { leaseLost = true; }); }, 25000);
    try {
      for (const item of job.items) {
        if (leaseLost) throw new Error("Export claim expired.");
        let path = null; let failure = null;
        try {
          if (item.status !== "issued") throw new Error("Credential is no longer active.");
          const batch = { issue_date: item.issue_date, category: item.category, subtype: item.subtype, template: item.template, issuing_authority: item.issuing_authority };
          const pdf = await render({ templatePath: config.templatePath, yaleSignaturePath: config.yaleSignaturePath, signatureKey: item.signature_key, fields: fieldsFor(batch, item.recipient, item.number, false), output: "pdf" });
          if (leaseLost) throw new Error("Export claim expired.");
          path = `${job.batch_id}/${item.id}.pdf`;
          await storePdf(path, pdf);
        } catch (error) {
          if (leaseLost) throw error;
          failure = error instanceof Error && error.message.startsWith("Text exceeds") ? error.message.slice(0, 500) : "PDF generation or storage failed.";
          path = null;
        }
        await rpc("record_credential_export_item", { ...lease, p_credential_id: item.id, p_path: path, p_failure: failure });
      }
      if (leaseLost) throw new Error("Export claim expired.");
      await rpc("finish_credential_export", lease);
      return true;
    } finally { clearInterval(timer); }
  }
  return { runOnce };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const worker = createExportWorker({ supabaseUrl: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, templatePath: process.env.CREDENTIAL_PRIVATE_TEMPLATE, yaleSignaturePath: process.env.CREDENTIAL_PRIVATE_YALE_SIGNATURE });
  let stopping = false;
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { stopping = true; });
  while (!stopping) {
    try { if (!await worker.runOnce()) await new Promise(resolve => setTimeout(resolve, 5000)); }
    catch { await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
}
