"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";

const dismissedKey = "econmind-season1-home-promo-dismissed-v1";

export function Season1HomePromo() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setVisible(window.sessionStorage.getItem(dismissedKey) !== "true");
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.sessionStorage.setItem(dismissedKey, "true");
    } catch {
      // The close control still works when browser storage is unavailable.
    }
  }

  if (!visible) return null;

  return (
    <aside aria-label="Season 1 announcement" className="fixed bottom-4 right-4 z-[70] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#6b8c8a] bg-[#071820] text-white shadow-[0_24px_80px_rgba(0,0,0,.45)] sm:bottom-6 sm:right-6">
      <Link href="/season1" onClick={dismiss} className="group relative block min-h-[238px] overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#b9e9e5]" aria-label="Open EconMind World Season 1">
        <Image src={withBasePath("/images/season1/season1-gateway-wide.jpg")} alt="" fill loading="eager" sizes="(max-width: 640px) calc(100vw - 2rem), 420px" className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]" />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,15,24,.88)_0%,rgba(3,15,24,.25)_50%,rgba(3,15,24,.94)_100%)]" />
        <span className="relative flex min-h-[238px] flex-col justify-between p-5 pr-14 sm:p-6 sm:pr-14">
          <span className="text-[10px] font-extrabold uppercase tracking-[.24em] text-[#b5e1df]">EconMind World · Season 1</span>
          <span>
            <strong className="block font-serif text-3xl leading-tight tracking-[-.045em] sm:text-[2.1rem]">The world opens soon.</strong>
            <span className="mt-2 block text-xs font-medium leading-5 text-white/80">Build teams. Shape strategies. Simulate real change.</span>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#c9ad75] bg-[#0b2229]/80 px-3 py-2 text-xs font-bold text-[#f4dcaa] transition-colors group-hover:bg-[#12343c]">Open Season 1 <ArrowUpRight size={14} /></span>
          </span>
        </span>
      </Link>
      <button type="button" onClick={dismiss} aria-label="Dismiss Season 1 announcement" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/40 bg-[#071820]/80 text-white transition hover:bg-[#153843] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9e9e5]">
        <X size={17} aria-hidden="true" />
      </button>
    </aside>
  );
}
