import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  Copyright,
  FileText,
  Globe2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { PolicyDocument } from "@/lib/legal/document-registry";
import { POLICY_PUBLICATION, POLICY_SCOPE } from "@/lib/legal/publication";
import {
  OFFICIAL_CONTACT_EMAIL,
  OFFICIAL_CONTACT_MAILTO,
} from "@/lib/platform/contact";

const icons = {
  terms: FileText,
  privacy: ShieldCheck,
  community: UsersRound,
  integrity: BookOpenCheck,
  rights: Copyright,
  world: Globe2,
};
export function PolicyCard({
  document,
  index,
}: {
  document: PolicyDocument;
  index: number;
}) {
  const Icon = icons[document.icon];
  return (
    <Link href={document.route} className="policy-card">
      <div className="policy-card-top">
        <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <h3>{document.title}</h3>
      <p>{document.description}</p>
      <span className="policy-card-action">
        Read document <ArrowUpRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
export function PolicyScope({ world = false }: { world?: boolean }) {
  return (
    <aside className="policy-scope" aria-label="Document scope">
      <span className="policy-kicker">
        {world
          ? "World-specific documents"
          : "Separate scopes. Clear responsibilities."}
      </span>
      <p>{POLICY_SCOPE}</p>
    </aside>
  );
}
export function PolicyPublication({ world = false }: { world?: boolean }) {
  // A local build must not claim publication. The approved production artifact
  // becomes public only after its deployment has actually succeeded.
  const published =
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_PAGES === "true";
  return (
    <div className="policy-publication">
      <span>
        {world
          ? `Official source edition · ${POLICY_PUBLICATION.worldEdition}`
          : `Website version ${POLICY_PUBLICATION.version}`}
      </span>
      <span>
        {published
          ? `Published ${POLICY_PUBLICATION.releaseDate} · effective on successful website publication`
          : "Publication preview · not yet effective"}
      </span>
      {!world && <span>Source: {POLICY_PUBLICATION.source}</span>}
    </div>
  );
}
export function PolicyContact() {
  return (
    <aside className="policy-contact">
      <div>
        <span className="policy-kicker">Questions & requests</span>
        <h2>Start with the right conversation.</h2>
        <p>
          For legal, privacy, intellectual property, access or moderation
          concerns, email the official contact. Never include passwords or
          sign-in codes.
        </p>
      </div>
      <a href={OFFICIAL_CONTACT_MAILTO}>
        {OFFICIAL_CONTACT_EMAIL}
        <ArrowUpRight size={18} aria-hidden="true" />
      </a>
    </aside>
  );
}
