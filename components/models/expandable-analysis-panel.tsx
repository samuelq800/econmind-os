"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExpandableAnalysisPanel({
  title,
  subtitle,
  children,
  className = "",
  modelLabel,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  modelLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => focusables()[0]?.focus(), 0);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [expanded]);

  const open = () => setExpanded(true);
  const close = () => setExpanded(false);
  const print = () => window.print();

  if (expanded) {
    return (
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-[var(--canvas)]">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-sm sm:px-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--accent)]">{modelLabel ?? "EconMind OS"}</p>
            <h2 className="mt-1 text-lg font-bold sm:text-xl">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={print}><Printer size={15} />Print / PDF</Button>
            <Button size="sm" onClick={close}><X size={16} />Close</Button>
          </div>
        </header>
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8 lg:p-10">
          {subtitle && <p className="mb-6 max-w-4xl text-base leading-7 text-[var(--ink-muted)]">{subtitle}</p>}
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </div>
      </section>
    );
  }

  return (
    <section className={"relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6 " + className}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{subtitle}</p>}
        </div>
        <button type="button" onClick={open} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--ink)] shadow-sm hover:bg-[var(--surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
          <Maximize2 size={14} />Expand
        </button>
      </div>
      {children}
    </section>
  );
}
