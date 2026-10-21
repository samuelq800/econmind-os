import Link from "next/link";
import { ArrowUpRight, Globe2, ShieldCheck } from "lucide-react";
import { LEGAL_POLICY_DOCUMENTS } from "@/lib/legal/document-registry";
import { compiledPolicy } from "@/lib/legal/documents";
import { POLICY_PUBLICATION } from "@/lib/legal/publication";
import {
  PolicyCard,
  PolicyContact,
  PolicyPublication,
  PolicyScope,
} from "@/components/legal/policy-primitives";

export function PolicyCenter({ world = false }: { world?: boolean }) {
  const documents = LEGAL_POLICY_DOCUMENTS.filter(
    (document) => document.scope === (world ? "world" : "platform"),
  );
  const information = world ? null : compiledPolicy("legal-index.md");
  return (
    <main className="policy-center" lang="en">
      <header className="policy-hero">
        <div className="policy-hero-copy">
          <p className="policy-kicker">
            {world
              ? "Legal & Policies / World"
              : "EconMind League / Official information"}
          </p>
          <h1>
            {world ? (
              <>
                EconMind World<span>Official Documents</span>
              </>
            ) : (
              <>
                Legal <em>&</em> Policies
              </>
            )}
          </h1>
          <p className="policy-lead">
            {world
              ? "Project information, participation terms and personal-information practices for the original fictional economic simulation."
              : "Official policies, rights, responsibilities and participation information for EconMind League and its related services."}
          </p>
          <PolicyPublication world={world} />
        </div>
        <div className="policy-hero-seal" aria-hidden="true">
          {world ? (
            <Globe2 strokeWidth={0.7} />
          ) : (
            <ShieldCheck strokeWidth={0.7} />
          )}
          <span>
            {world
              ? "Fictional world. Defined scope."
              : "Rights. Responsibilities. Respect."}
          </span>
        </div>
      </header>
      <nav className="policy-jump-links" aria-label="Legal Center sections">
        {world ? (
          <Link href="/legal/">← Main Legal Center</Link>
        ) : (
          <>
            <a href="#platform-policies">EconMind Platform</a>
            <a href="#world-documents">EconMind World</a>
            <a href="#publication-information">Publication information</a>
          </>
        )}
      </nav>
      <PolicyScope world={world} />
      <section id="platform-policies" className="policy-section">
        <div className="policy-section-title">
          <div>
            <p className="policy-kicker">
              {world ? "World / 03 documents" : "01 / Core platform"}
            </p>
            <h2>
              {world ? "Read the official documents." : "EconMind Platform"}
            </h2>
          </div>
          <p>
            {world
              ? "Each document applies within its own stated scope."
              : "Five documents. One place to understand participation."}
          </p>
        </div>
        <div
          className={`policy-card-grid${world ? " policy-card-grid-world" : ""}`}
        >
          {documents.map((document, index) => (
            <PolicyCard key={document.key} document={document} index={index} />
          ))}
        </div>
      </section>
      {!world && (
        <section className="policy-world-band" id="world-documents">
          <div>
            <p className="policy-kicker">02 / Independently scoped project</p>
            <h2>EconMind World</h2>
            <p>
              World has its own project introduction, Terms of Use and Privacy
              Notice. These documents cover the fictional simulation and Season
              1 within their stated scope.
            </p>
            <Link href="/legal/world/">
              Explore World documents{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <Globe2 size={150} strokeWidth={0.5} aria-hidden="true" />
        </section>
      )}
      {information && (
        <section
          id="publication-information"
          className="policy-publication-information"
        >
          <div className="policy-section-title">
            <div>
              <p className="policy-kicker">03 / Legal information</p>
              <h2>Scope, contact & publication.</h2>
            </div>
          </div>
          <article
            className="policy-prose"
            aria-label="Legal Homepage full text"
            dangerouslySetInnerHTML={{ __html: information.html }}
          />
          <PublicationRegister />
        </section>
      )}
      {world && (
        <p className="policy-world-credit">
          © 2026 Samuel. Created by Samuel, operated under EconMind. All rights
          reserved.
          <br />
          This notice concerns protected original World contributions; other
          lawful rights holders retain their rights.
        </p>
      )}
      <PolicyContact />
    </main>
  );
}
function PublicationRegister() {
  const published =
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_PAGES === "true";
  return (
    <div className="policy-register">
      <h3>Publication register</h3>
      <PolicyPublication />
      <div className="policy-register-documents">
        {LEGAL_POLICY_DOCUMENTS.map((document) => (
          <div key={document.key}>
            <Link href={document.route}>
              {document.scope === "world" ? "World / " : "Platform / "}
              {document.title}
            </Link>
            <span>
              {document.scope === "world"
                ? `Source edition ${POLICY_PUBLICATION.worldEdition}`
                : `Website v${POLICY_PUBLICATION.version}`}{" "}
              ·{" "}
              {published
                ? POLICY_PUBLICATION.releaseDate
                : "Publication pending"}
            </span>
          </div>
        ))}
      </div>
      <p>
        New publication does not retroactively change permissions or historic
        consent records. Signed-in accounts confirm current platform and World
        documents individually; earlier records are not upgraded to v2.0 acceptance.
      </p>
      <div className="policy-register-links">
        <Link href="/legal/previous/terms/">Prior Terms v1.2</Link>
        <Link href="/legal/previous/privacy/">Prior Privacy v1.1</Link>
      </div>
    </div>
  );
}
