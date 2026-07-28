import { ExpandableAnalysisPanel } from "@/components/models/expandable-analysis-panel";

export function ChartContainer({ title, subtitle, children, className = "", modelLabel }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; modelLabel?: string }) {
  return <ExpandableAnalysisPanel title={title} subtitle={subtitle} className={className} modelLabel={modelLabel}>{children}</ExpandableAnalysisPanel>;
}
