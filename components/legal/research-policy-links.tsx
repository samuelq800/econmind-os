import Link from "next/link";
export function ResearchPolicyLinks() {
  return (
    <aside
      className="my-6 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-xs leading-6 text-[var(--ink-muted)]"
      aria-label="Research rights and submission information"
    >
      <p>
        Research works remain with their authors or other lawful rights holders.
        Read the applicable policies before sharing; the publication-permission
        choice below remains separate.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-bold text-[var(--accent)]">
        <Link className="underline underline-offset-4" href="/legal/integrity/">
          Academic and Research Integrity
        </Link>
        <Link
          className="underline underline-offset-4"
          href="/legal/intellectual-property/"
        >
          Intellectual Property Policy
        </Link>
        <Link
          className="underline underline-offset-4"
          href="/legal/terms/#6-your-submissions-and-permissions"
        >
          Submissions & permissions
        </Link>
      </div>
    </aside>
  );
}
