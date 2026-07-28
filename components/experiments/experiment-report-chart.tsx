"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/models/chart-container";
import { adAsChartData, type AdAsParameters } from "@/lib/economics/ad-as";
import { demandCurveData, type ElasticityParameters } from "@/lib/economics/elasticity";
import { externalityChartData, type ExternalityParameters } from "@/lib/economics/externalities";
import { monopolyChartData, type MonopolyParameters } from "@/lib/economics/monopoly";
import { policyChartData, type PolicyParameters } from "@/lib/economics/policy";
import { ppfChartData, type PpfParameters } from "@/lib/economics/ppf";
import { priceControlChartData, type PriceControlParameters } from "@/lib/economics/price-controls";
import { marketChartData } from "@/lib/economics/supply-demand";
import type { MarketParameters } from "@/lib/economics/types";
import type { FocusedModelKey } from "@/lib/experiments/model-runtime";

type LineSpec = { key: string; label: string; color: string; dashed?: boolean };
type ChartDefinition = { title: string; subtitle: string; data: Array<Record<string, number | undefined>>; x: string; lines: LineSpec[] };

function chartFor(modelKey: FocusedModelKey, parameters: Record<string, number>): ChartDefinition {
  switch (modelKey) {
    case "supply-demand": return { title: "Recorded market curves", subtitle: "The chart is reconstructed from the final saved parameters.", data: marketChartData(parameters as MarketParameters), x: "quantity", lines: [{ key: "demand", label: "Demand", color: "var(--blue)" }, { key: "supply", label: "Supply", color: "var(--accent)" }] };
    case "policy": return { title: "Recorded policy wedge", subtitle: "Buyer demand, private supply, and the tax or subsidy-adjusted supply schedule.", data: policyChartData(parameters as PolicyParameters), x: "quantity", lines: [{ key: "demand", label: "Demand", color: "var(--blue)" }, { key: "supply", label: "Private supply", color: "var(--ink-faint)", dashed: true }, { key: "policySupply", label: "Policy supply", color: "var(--accent)" }] };
    case "price-controls": return { title: "Recorded price-control market", subtitle: "Demand and supply are shown at the legal-price setting saved with the attempt.", data: priceControlChartData({ ...parameters, controlType: parameters.controlType === 1 ? "floor" : "ceiling" } as PriceControlParameters), x: "quantity", lines: [{ key: "demand", label: "Demand", color: "var(--blue)" }, { key: "supply", label: "Supply", color: "var(--accent)" }] };
    case "elasticity": return { title: "Recorded demand curve", subtitle: "The saved operating price locates the point-elasticity calculation on this demand schedule.", data: demandCurveData(parameters as ElasticityParameters), x: "price", lines: [{ key: "quantity", label: "Quantity demanded", color: "var(--accent)" }] };
    case "externalities": return { title: "Recorded social-cost comparison", subtitle: "Social cost differs from private cost by the saved per-unit spillover.", data: externalityChartData(parameters as ExternalityParameters), x: "quantity", lines: [{ key: "demand", label: "Marginal benefit", color: "var(--blue)" }, { key: "privateCost", label: "Private cost", color: "var(--ink-faint)", dashed: true }, { key: "socialCost", label: "Social cost", color: "var(--accent)" }] };
    case "monopoly": return { title: "Recorded monopoly decision", subtitle: "The firm compares marginal revenue with marginal cost and reads price from demand.", data: monopolyChartData(parameters as MonopolyParameters), x: "quantity", lines: [{ key: "demand", label: "Demand", color: "var(--blue)" }, { key: "marginalRevenue", label: "Marginal revenue", color: "var(--accent)" }, { key: "marginalCost", label: "Marginal cost", color: "var(--amber)", dashed: true }] };
    case "ppf": return { title: "Recorded production frontier", subtitle: "Baseline and final capacity frontiers are reconstructed from the saved resource and growth settings.", data: ppfChartData(parameters as PpfParameters), x: "outputX", lines: [{ key: "baseline", label: "Baseline frontier", color: "var(--ink-faint)", dashed: true }, { key: "current", label: "Saved frontier", color: "var(--accent)" }] };
    case "ad-as": return { title: "Recorded AD–AS schedules", subtitle: "The final short-run aggregate-demand and aggregate-supply intersection is determined by the saved shocks.", data: adAsChartData(parameters as AdAsParameters), x: "output", lines: [{ key: "aggregateDemand", label: "Aggregate demand", color: "var(--blue)" }, { key: "shortRunSupply", label: "Short-run supply", color: "var(--accent)" }] };
  }
}

export function ExperimentReportChart({ modelKey, parameters, modelLabel }: { modelKey: FocusedModelKey; parameters: Record<string, number>; modelLabel?: string }) {
  const chart = chartFor(modelKey, parameters);
  return <ChartContainer title={chart.title} subtitle={chart.subtitle} modelLabel={modelLabel}>
    <div className="h-[340px] sm:h-[420px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart.data} margin={{ top: 18, right: 24, left: -6, bottom: 8 }}><CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey={chart.x} type="number" tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} /><YAxis tick={{ fill: "var(--ink-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />{chart.lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2.5} strokeDasharray={line.dashed ? "6 4" : undefined} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div>
  </ChartContainer>;
}
