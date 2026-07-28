import { notFound } from "next/navigation";
import { CaseWorkbench } from "@/components/cases/case-workbench";
import { CASE_BY_SLUG, ECONOMIC_CASES } from "@/lib/cases/definitions";

export function generateStaticParams() { return ECONOMIC_CASES.map((item) => ({ slug: item.slug })); }
export default async function CasePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const definition = CASE_BY_SLUG[slug]; if (!definition) notFound(); return <CaseWorkbench definition={definition} />; }
