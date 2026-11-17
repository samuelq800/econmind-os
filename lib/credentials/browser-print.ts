import type { ImportedRecipient } from "./import";

const TEMPLATE_HASH = "591e6c0d67eec9b59ed856f060eca4d3ad5ed8d041b91bf3f67361cf0da6a358";
const YALE_HASH = "587af46f950be365383eb8505e77ec072472df5dbc77f6aba734f8ebdf161c53";
const categories: Record<string, string> = { MEM: "MEMBERSHIP", PAR: "PARTICIPATION", CON: "CONTRIBUTION", LEA: "LEADERSHIP", DIS: "DISTINCTION" };

export type VisualAssets = { template_html: string; yale_signature: string };
export type RenderBatch = { issue_date: string; issuing_authority: string; signature_key: string; category: string; subtype: string; template: Record<string, string> };

async function sha256(bytes: BufferSource): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
}

/** Only the approved original may be displayed, and recipient values are text. */
export async function certificatePrintHtml(assets: VisualAssets, batch: RenderBatch, entry: ImportedRecipient, number: string | null): Promise<string> {
  if (await sha256(new TextEncoder().encode(assets.template_html)) !== TEMPLATE_HASH) throw new Error("The certificate template does not match the approved original.");
  const yaleRaw = atob(assets.yale_signature.replace(/\s/g, ""));
  const yaleBytes = Uint8Array.from(yaleRaw, c => c.charCodeAt(0));
  if (await sha256(yaleBytes) !== YALE_HASH) throw new Error("The Yale signature does not match its approved original.");
  if (!(batch.signature_key === "samuel_qian_v1" || batch.signature_key === "yale_chen_v1")) throw new Error("Unknown signature version.");
  const doc = new DOMParser().parseFromString(assets.template_html, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, form, link").forEach(el => el.remove());
  doc.querySelectorAll("*").forEach(el => {
    for (const attribute of [...el.attributes]) if (/^on/i.test(attribute.name) || attribute.name === "contenteditable") el.removeAttribute(attribute.name);
  });
  const csp = doc.createElement("meta"); csp.httpEquiv = "Content-Security-Policy";
  csp.content = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";
  doc.head.prepend(csp);
  const badge = doc.querySelector<HTMLImageElement>("#officialBadge"), watermark = doc.querySelector<HTMLImageElement>("#badgeWatermark");
  if (!badge || !watermark || !badge.getAttribute("src")?.startsWith("data:")) throw new Error("The approved badge is unavailable.");
  watermark.src = badge.src;
  const signature = doc.querySelector<HTMLImageElement>(".signature-image");
  if (!signature) throw new Error("The approved signature position is unavailable.");
  if (batch.signature_key === "yale_chen_v1") signature.src = `data:image/png;base64,${assets.yale_signature.replace(/\s/g, "")}`;
  const text = (selector: string, value: string) => { const el = doc.querySelector(selector); if (!el) throw new Error(`Missing certificate field ${selector}`); el.textContent = value; };
  const date = new Date(`${batch.issue_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const originalName = doc.querySelector<HTMLElement>(".award-name");
  if (!originalName) throw new Error("The approved name field is unavailable.");
  originalName.dataset.approvedBaseline = originalName.textContent || "";
  text(".award-name", entry.name);
  text(".award-role", entry.role || batch.template.role_description || "");
  text(".award-copy", [batch.template.certification_statement || "", entry.contribution || batch.template.contribution_paragraph || "", entry.service_period ? `Service period: ${entry.service_period}.` : batch.template.service_period_text || ""].filter(Boolean).join(" "));
  text(".category-kicker", `EconMind League · ${batch.subtype}`);
  const title = doc.querySelector(".title-main");
  const titleText = title && [...title.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
  if (!titleText) throw new Error("Missing certificate title.");
  titleText.textContent = batch.template.title || categories[batch.category] || "";
  text(".title-main .gold", ""); text(".title-sub", "");
  const scope = doc.querySelector(".scope");
  const nodes = scope && [...scope.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
  if (!nodes || nodes.length < 3) throw new Error("Missing certificate scope fields.");
  [entry.department || "", entry.project || "", entry.role || ""].forEach((value, index) => { nodes[index].textContent = value; });
  text(".footer-cell:nth-child(1) .footer-value", date);
  text(".footer-cell:nth-child(2) .footer-value", number || `EML-${batch.category}-${batch.issue_date.slice(0, 4)}-999999`);
  text("#issuingAuthority", batch.issuing_authority);
  text(".specimen", number ? "" : "Preview · Not an issued credential");
  doc.title = number ? `EconMind League Credential ${number}` : "EconMind League Credential Preview";
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
}

/** Return explicit problems; the administrator must also inspect print preview. */
export function printLayoutProblems(doc: Document): string[] {
  const problems: string[] = [];
  const certificate = doc.querySelector(".certificate");
  if (!certificate) return ["The certificate page is missing."];
  const page = certificate.getBoundingClientRect();
  for (const selector of [".award-name", ".award-role", ".award-copy", ".cert-heading", ".scope", ".footer-value", "#issuingAuthority"]) {
    doc.querySelectorAll(selector).forEach(el => {
      const bounds = el.getBoundingClientRect();
      let baselineVertical = 0;
      const htmlEl = el as HTMLElement;
      if (selector === ".award-name" && htmlEl.dataset.approvedBaseline !== undefined) {
        const current = el.textContent;
        el.textContent = htmlEl.dataset.approvedBaseline;
        baselineVertical = Math.max(0, el.scrollHeight - el.clientHeight);
        el.textContent = current;
      }
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + baselineVertical + 1 || bounds.left < page.left - 1 || bounds.right > page.right + 1 || bounds.bottom > page.bottom + 1) problems.push(selector);
    });
  }
  for (const [a, b] of [[".award-copy", ".scope"], [".award-role", ".award-copy"], [".cert-heading", ".award-intro"]]) {
    const first = doc.querySelector(a), second = doc.querySelector(b);
    if (!first || !second || first.getBoundingClientRect().bottom > second.getBoundingClientRect().top + 1) problems.push(`${a} overlaps ${b}`);
  }
  return [...new Set(problems)];
}
