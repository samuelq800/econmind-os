import Link from "next/link";
export function Season1PolicyLinks() {
  return (
    <aside
      className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--ink-muted)]"
      aria-label="Season 1 official policies"
    >
      <span className="font-bold text-[var(--accent)]">
        World participation documents
      </span>
      <Link href="/legal/world/terms/" className="underline underline-offset-4">
        World Terms of Use
      </Link>
      <Link
        href="/legal/world/privacy/"
        className="underline underline-offset-4"
      >
        World Privacy Notice
      </Link>
      <Link href="/legal/" className="underline underline-offset-4">
        Platform policies
      </Link>
      <p className="w-full text-[10px] leading-5">
        These links provide policy access; they are not a record of separate
        consent or guardian authorisation.
      </p>
    </aside>
  );
}
