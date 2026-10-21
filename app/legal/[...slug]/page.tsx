import { notFound } from "next/navigation";
import { PolicyDocumentPage } from "@/components/legal/policy-document";
import {
  LEGAL_POLICY_DOCUMENTS,
  policyByKey,
} from "@/lib/legal/document-registry";
import { policyMetadata } from "@/lib/legal/documents";
export const dynamicParams = false;
export function generateStaticParams() {
  return LEGAL_POLICY_DOCUMENTS.map((document) => ({
    slug: document.key.split("/"),
  }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const document = policyByKey((await params).slug.join("/"));
  return document
    ? policyMetadata(
        `${document.scope === "world" ? "EconMind World — " : ""}${document.title}`,
        document.route,
        document.description,
      )
    : {};
}
export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const document = policyByKey((await params).slug.join("/"));
  if (!document) notFound();
  return <PolicyDocumentPage document={document} />;
}
