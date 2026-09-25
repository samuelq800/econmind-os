"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { emailHtmlDocument } from "@/lib/mail/render-html";

export function MailHtmlBody({ html, fallback }: { html: string; fallback: string }) {
  const [loadRemoteImages, setLoadRemoteImages] = useState(false);
  const [showPlainText, setShowPlainText] = useState(false);
  const document = useMemo(() => emailHtmlDocument(html, loadRemoteImages), [html, loadRemoteImages]);

  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
      <span>HTML email · scripts and forms blocked</span>
      <div className="flex flex-wrap gap-2">
        {!loadRemoteImages && <Button type="button" size="sm" variant="secondary" onClick={() => setLoadRemoteImages(true)}>Load remote images</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowPlainText((value) => !value)}>{showPlainText ? "Show formatted email" : "Show plain text"}</Button>
      </div>
    </div>
    {showPlainText ? <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{fallback || "No plain-text content. The original message is available in the forwarded management copy."}</p> : <iframe title="Formatted email content" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" loading="lazy" srcDoc={document} className="h-[min(70vh,720px)] min-h-80 w-full rounded-lg border border-[var(--line)] bg-white" />}
    <p className="mt-2 text-[11px] leading-5 text-[var(--ink-muted)]">Embedded attachment images may only be visible in the forwarded management copy. Loading remote images may notify the sender that this email was opened.</p>
  </div>;
}
