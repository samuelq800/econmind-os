"use client";
import { useEffect, useRef, useState } from "react";
import { certificatePrintHtml, printLayoutProblems, type RenderBatch, type VisualAssets } from "@/lib/credentials/browser-print";
import type { ImportedRecipient } from "@/lib/credentials/import";
import type { WordingContent } from "@/lib/credentials/wording";
import { parseCertificateDate } from "@/lib/credentials/date";

export type CanvasModel = { batch: RenderBatch; recipient: ImportedRecipient; wording: WordingContent };
type Props = {
  assets: VisualAssets | null;
  model: CanvasModel;
  mode: "blank" | "filled" | "review";
  onRecipient: (key: keyof ImportedRecipient, value: string) => void;
  onWording: (key: keyof WordingContent, value: string) => void;
  onDate: (value: string) => void;
  onDateError: (invalid: boolean) => void;
  onProblems: (problems: string[]) => void;
};

/** The frame is the same hash-verified HTML used for printing, with only
 * plain-text editing attached by the parent. No executable script is injected. */
export function CredentialCanvas(props: Props) {
  const { assets, model, mode } = props;
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const [html, setHtml] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(1180);
  const [fit, setFit] = useState(true);
  const modelKey = JSON.stringify(model);

  useEffect(() => {
    if (!assets) return;
    const currentFrame = frame.current;
    // Never reload while the administrator is typing in the certificate.
    if (document.activeElement === currentFrame && currentFrame?.contentDocument?.activeElement !== currentFrame?.contentDocument?.body) return;
    const serial = ++generation.current;
    const blank = mode === "blank";
    const batch = { ...model.batch, template: blank ? {} : { ...model.wording,
      title: model.wording.title || "[Certificate Title]",
      certification_statement: model.wording.certification_statement || "[Certification Statement]",
    } };
    const recipient = blank ? { name: "", role: "", department: "", project: "", contribution: "", service_period: "" } : {
      ...model.recipient, name: model.recipient.name || "[Recipient Name]",
    };
    void certificatePrintHtml(assets, batch, recipient, null).then(value => {
      if (generation.current === serial) {
        const doc = new DOMParser().parseFromString(value, "text/html");
        // The original file's demonstration toolbar is outside the certificate
        // and has no working actions in the sandbox. Keep the certificate intact.
        doc.querySelector(".toolbar")?.remove();
        if (!blank && !model.recipient.role && !model.wording.role_description) {
          const role = doc.querySelector(".award-role"); if (role) role.textContent = "[Role / Position]";
        }
        if (blank) {
          for (const selector of [".category-kicker", ".footer-cell:nth-child(1) .footer-value", ".footer-cell:nth-child(2) .footer-value", "#issuingAuthority"]) {
            const node = doc.querySelector(selector); if (node) node.textContent = "";
          }
          const title = doc.querySelector(".title-main");
          const titleText = title && [...title.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
          if (titleText) titleText.textContent = "";
        }
        value = `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
        setError(""); setHtml(value);
      }
    }).catch(cause => { if (generation.current === serial) setError(cause instanceof Error ? cause.message : "Certificate preview unavailable."); });
    return () => { generation.current = serial + 1; };
  // JSON value tracking avoids reloading on unrelated parent renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, modelKey, mode, revision]);
  useEffect(() => () => { cleanup.current?.(); }, []);
  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 1180));
    observer.observe(node); return () => observer.disconnect();
  }, []);

  function loaded() {
    cleanup.current?.();
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    let disposed = false;
    const removers: (() => void)[] = [];
    const refreshProblems = async () => {
      try {
        await doc.fonts.ready;
        await Promise.all([...doc.images].map(image => image.decode()));
        if (!disposed) latest.current.onProblems(printLayoutProblems(doc));
      } catch { if (!disposed) latest.current.onProblems(["Certificate images or fonts could not be loaded."]); }
    };
    const editable = (el: HTMLElement | null, label: string, change: (value: string) => void, options?: { date?: boolean; placeholder?: string }) => {
      if (!el || latest.current.mode !== "filled") return;
      el.setAttribute("contenteditable", "plaintext-only");
      el.setAttribute("role", "textbox"); el.setAttribute("aria-label", label); el.setAttribute("tabindex", "0");
      el.style.cursor = "text";
      const focus = () => {
        if (!options?.placeholder || el.textContent !== options.placeholder) return;
        const selection = doc.getSelection(), range = doc.createRange(); range.selectNodeContents(el);
        selection?.removeAllRanges(); selection?.addRange(range);
      };
      const input = () => { if (!options?.date) change((el.textContent || "").slice(0, label === "Recipient name" ? 200 : 4000)); void refreshProblems(); };
      const blur = () => {
        if (options?.date) {
          const value = parseCertificateDate(el.textContent || "");
          if (value) { latest.current.onDateError(false); change(value); }
          else { latest.current.onDateError(true); return; }
        }
        setRevision(n => n + 1);
      };
      const paste = (event: ClipboardEvent) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain") ?? "";
        // The frame contains only plain text. Rich HTML never enters the document.
        const selection = doc.getSelection();
        if (!selection?.rangeCount || !el.contains(selection.anchorNode)) return;
        const range = selection.getRangeAt(0); range.deleteContents();
        const node = doc.createTextNode(text.replace(/\r\n?/g, "\n")); range.insertNode(node);
        range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
        input();
      };
      const beforeInput = (event: InputEvent) => { if (event.inputType.startsWith("format") || event.inputType === "insertFromDrop") event.preventDefault(); };
      const drop = (event: DragEvent) => event.preventDefault();
      el.addEventListener("focus", focus); el.addEventListener("input", input); el.addEventListener("blur", blur); el.addEventListener("paste", paste); el.addEventListener("beforeinput", beforeInput); el.addEventListener("drop", drop);
      removers.push(() => { el.removeEventListener("focus", focus); el.removeEventListener("input", input); el.removeEventListener("blur", blur); el.removeEventListener("paste", paste); el.removeEventListener("beforeinput", beforeInput); el.removeEventListener("drop", drop); });
    };
    editable(doc.querySelector(".award-name"), "Recipient name", value => latest.current.onRecipient("name", value), {placeholder:"[Recipient Name]"});
    editable(doc.querySelector(".award-role"), "Role / position", value => latest.current.onRecipient("role", value), {placeholder:"[Role / Position]"});
    editable(doc.querySelector(".title-main"), "Certificate title", value => latest.current.onWording("title", value), {placeholder:"[Certificate Title]"});
    editable(doc.querySelector(".footer-cell:nth-child(1) .footer-value"), "Issue date", value => latest.current.onDate(value), { date: true });
    const copy = doc.querySelector<HTMLElement>(".award-copy");
    if (copy && latest.current.mode === "filled") {
      // Inline spans have no visual style. Their concatenated text is exactly
      // the production print renderer's text, and the approved CSS is unchanged.
      const { wording, recipient } = latest.current.model;
      const parts: { text: string; label: string; change: (value: string) => void }[] = [
        { text: wording.certification_statement || "[Certification Statement]", label: "Certification statement", change: (value: string) => latest.current.onWording("certification_statement", value) },
        { text: recipient.contribution || wording.contribution_paragraph, label: "Contribution description", change: (value: string) => latest.current.onRecipient("contribution", value) },
        { text: recipient.service_period ? `Service period: ${recipient.service_period}.` : wording.service_period_text, label: "Service period text", change: (value: string) => {
          if (latest.current.model.recipient.service_period) latest.current.onRecipient("service_period", value.replace(/^Service period:\s*/i, "").replace(/\.$/, ""));
          else latest.current.onWording("service_period_text", value);
        } },
      ].filter(part => Boolean(part.text));
      copy.replaceChildren();
      parts.forEach((part, index) => {
        if (index) copy.append(doc.createTextNode(" "));
        const span = doc.createElement("span"); span.textContent = part.text; copy.append(span);
        editable(span, part.label, part.change, {placeholder:part.label === "Certification statement" ? "[Certification Statement]" : undefined});
      });
      if (!parts.length) {
        editable(copy, "Certification statement", value => latest.current.onWording("certification_statement", value));
      }
    }
    const style = doc.createElement("style");
    style.textContent = '[contenteditable="plaintext-only"]:focus{outline:1px dashed #a07840;outline-offset:2px}';
    doc.head.append(style);
    void refreshProblems();
    cleanup.current = () => { disposed = true; removers.forEach(remove => remove()); };
  }

  const scale = fit ? Math.min(1, Math.max(0.25, (width - 24) / 1180)) : 1;
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-[var(--red)]">{error}</p>}
    {!assets && <p className="text-sm text-[var(--ink-muted)]">Loading the approved private certificate…</p>}
    <div className="flex justify-end"><button type="button" className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs font-semibold" onClick={() => setFit(value => !value)}>{fit ? "Actual size" : "Fit to screen"}</button></div>
    <div ref={viewport} className="max-w-full overflow-auto rounded-lg border border-[var(--line)] bg-[#cbd0d0] p-3">
      {html && <div style={{ width:1180 * scale, height:850 * scale }}><iframe ref={frame} title="Live certificate canvas" sandbox="allow-same-origin allow-modals" srcDoc={html} onLoad={loaded} className="block border-0 bg-white" style={{ width:1180, height:850, transform:`scale(${scale})`, transformOrigin:"top left" }} /></div>}
    </div>
    <p className="text-xs text-[var(--ink-muted)]">{mode === "filled" ? "Click text on the certificate to edit it. Only plain text can be changed." : mode === "review" ? "Final review is read-only. Numbers are allocated only on issuance." : "Blank preview uses the same approved certificate."}</p>
  </div>;
}
