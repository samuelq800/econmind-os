"use client";

import { CREDENTIAL_SIGNATURES, type CredentialSignatureKey } from "@/lib/credentials/signatures";

export function CredentialSignatureSelect({ value, onChange }: { value: CredentialSignatureKey; onChange: (key: CredentialSignatureKey) => void }) {
  return <label className="block text-sm font-semibold">Signatory <span aria-hidden="true">*</span>
    <select value={value} onChange={event => onChange(event.target.value as CredentialSignatureKey)} className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--ink)]">
      {CREDENTIAL_SIGNATURES.map(signature => <option key={signature.key} value={signature.key}>{signature.label} · {signature.title}</option>)}
    </select>
  </label>;
}
