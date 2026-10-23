"use client";
import Link from "next/link";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  emptyPolicyChecks,
} from "@/lib/legal/acknowledgement";
import type { LegalAcceptance } from "@/lib/legal/legal-config";

export function RegistrationPolicyFields({
  value,
  onChange,
}: {
  value: LegalAcceptance;
  onChange: (value: LegalAcceptance) => void;
}) {
  const checks = value.policies ?? emptyPolicyChecks();
  return (
    <fieldset className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      <legend className="px-1 font-bold">
        Current policies · 21 October 2026 *
      </legend>
      <p>
        Confirm each document to register. Your confirmation is saved to your
        account, so it will not be requested again for this edition.
      </p>
      {ACKNOWLEDGEMENT_DOCUMENTS.map((document) => (
        <label
          key={document.key}
          className="flex cursor-pointer items-start gap-3"
        >
          <input
            required
            type="checkbox"
            checked={checks[document.key] === true}
            className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
            onChange={(event) => {
              const next = { ...checks, [document.key]: event.target.checked };
              onChange({
                terms: next.terms === true,
                privacy: next.privacy === true,
                policies: next,
              });
            }}
          />
          <span>
            I have read{document.action === "agree" ? " and agree to" : ""} the{" "}
            <Link
              href={document.route}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--accent)] underline"
            >
              {document.scope === "world" ? "EconMind World · " : ""}
              {document.title}{" "}
              {document.scope === "world"
                ? `(${document.version})`
                : `v${document.version}`}
            </Link>
            . *
          </span>
        </label>
      ))}
    </fieldset>
  );
}
