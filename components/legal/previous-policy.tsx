import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "@/lib/legal/legal-content";
import { LEGAL_DOCUMENTS } from "@/lib/legal/legal-config";

export function PreviousPolicy({
  document,
}: {
  document: "terms" | "privacy";
}) {
  const previous = LEGAL_DOCUMENTS[document];
  return (
    <>
      <aside className="mx-auto mt-8 max-w-6xl rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-5 text-sm leading-7">
        <strong>Prior published text — retained for version history.</strong>
        <p>
          References to “current” in this historic copy belong to that earlier
          publication. Existing acknowledgement records remain unchanged and are
          not v2.0 acceptance.
        </p>
        <Link
          className="font-bold text-[var(--accent)] underline"
          href={`/legal/${document}/`}
        >
          Read the latest published {previous.title} →
        </Link>
      </aside>
      <LegalPage
        eyebrow="Prior publication / historical text"
        title={`${previous.title} — v${previous.version}`}
        summary="Historical publication retained for reference, not the current website policy."
        version={previous.version}
        effectiveDate={previous.effectiveDate}
        sections={document === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS}
      />
    </>
  );
}
