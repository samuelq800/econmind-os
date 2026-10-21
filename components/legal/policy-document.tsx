import Link from "next/link";
import { ChevronLeft, ArrowUpRight } from "lucide-react";
import { compiledPolicy } from "@/lib/legal/documents";
import {
  LEGAL_POLICY_DOCUMENTS,
  type PolicyDocument,
} from "@/lib/legal/document-registry";
import { PolicyToc } from "@/components/legal/policy-toc";
import {
  PolicyContact,
  PolicyPublication,
  PolicyScope,
} from "@/components/legal/policy-primitives";

export function PolicyDocumentPage({ document }: { document: PolicyDocument }) {
  const compiled = compiledPolicy(document.file);
  const world = document.scope === "world";
  const siblings = LEGAL_POLICY_DOCUMENTS.filter(
    (item) => item.scope === document.scope && item.key !== document.key,
  );
  return (
    <main className="policy-center policy-reader" id="policy-top" lang="en">
      <header className="policy-document-header">
        <Link
          className="policy-return"
          href={world ? "/legal/world/" : "/legal/"}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          {world ? "EconMind World — Official Documents" : "Legal & Policies"}
        </Link>
        <p className="policy-kicker">
          {world ? "EconMind World" : "EconMind Platform"} / Official document
        </p>
        <h1>{document.title}</h1>
        <p className="policy-lead">{document.description}</p>
        <PolicyPublication world={world} />
      </header>
      <PolicyScope world={world} />
      <div className="policy-reading-grid">
        <PolicyToc headings={compiled.headings} />
        <article
          className="policy-prose"
          aria-label={`${world ? "World " : ""}${document.title} full text`}
          dangerouslySetInnerHTML={{ __html: compiled.html }}
        />
      </div>
      <section className="policy-related" aria-label="Related documents">
        <span className="policy-kicker">Continue reading</span>
        <div>
          {siblings.map((item) => (
            <Link key={item.key} href={item.route}>
              {item.title}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <PolicyContact />
    </main>
  );
}
