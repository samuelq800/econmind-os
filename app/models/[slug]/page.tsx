import { notFound } from "next/navigation";
import { ExtendedModelLab } from "@/components/models/extended-model-lab";
import { EXTENDED_MODEL_SLUGS, type ExtendedModelSlug } from "@/lib/economics/extended-models";

export const dynamicParams = false;

export function generateStaticParams() {
  return EXTENDED_MODEL_SLUGS.map((slug) => ({ slug }));
}

export default async function ExtendedModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!EXTENDED_MODEL_SLUGS.includes(slug as ExtendedModelSlug)) notFound();
  return <ExtendedModelLab model={slug as ExtendedModelSlug} />;
}
