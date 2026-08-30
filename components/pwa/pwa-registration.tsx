"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/base-path";

/**
 * Keeps installation optional while giving the static export a safe offline
 * shell. The worker deliberately does not intercept Supabase requests.
 */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    void navigator.serviceWorker.register(withBasePath("/sw.js"), {
      scope: withBasePath("/"),
    }).catch(() => {
      // A normal browser visit must remain fully usable if a host disallows
      // service workers or has not yet published the newest static asset.
    });
  }, []);

  return null;
}
