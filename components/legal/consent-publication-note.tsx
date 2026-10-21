import Link from "next/link";
import { CONSENT_PUBLICATION_NOTICE } from "@/lib/legal/publication";

export function ConsentPublicationNote() {
  return (
    <aside className="rounded-lg border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-[11px] leading-5 text-[var(--ink-muted)]">
      <p>{CONSENT_PUBLICATION_NOTICE}</p>
      <p className="mt-2">
        <Link
          href="/legal/"
          target="_blank"
          className="font-bold text-[var(--accent)] underline"
        >
          Current publication & version register
        </Link>
        {" · "}
        <Link
          href="/legal/previous/terms/"
          target="_blank"
          className="underline"
        >
          Prior Terms v1.2
        </Link>
        {" · "}
        <Link
          href="/legal/previous/privacy/"
          target="_blank"
          className="underline"
        >
          Prior Privacy v1.1
        </Link>
      </p>
    </aside>
  );
}
