"use client";

import { useMemo } from "react";
import { BarChart3, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  flexibleTeachingEstimates,
  restaurantProfit,
  type EvidenceProject,
} from "@/lib/evidence-lab/projects";

type Point = {
  x: string;
  y: number;
  secondary?: number;
  label?: string;
  group?: string;
};
const palette = ["#0b6b4f", "#2c68aa", "#b06616", "#9b4dca"];
const inner = { left: 36, right: 218, top: 16, bottom: 118 };
const linePath = (points: Array<{ x: number; y: number }>) =>
  points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ");
const scaled = (points: Point[]) => {
  const min = Math.min(
    ...points.flatMap((point) => [point.y, point.secondary ?? point.y]),
  );
  const max = Math.max(
    ...points.flatMap((point) => [point.y, point.secondary ?? point.y]),
  );
  const range = Math.max(max - min, 0.1);
  return {
    min,
    max,
    point: (value: number, index: number, count = points.length) => ({
      x:
        inner.left +
        index * ((inner.right - inner.left) / Math.max(count - 1, 1)),
      y: inner.bottom - ((value - min) / range) * (inner.bottom - inner.top),
    }),
  };
};

export function ChartFrame({
  title,
  subtitle,
  children,
  summary,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  summary: string;
}) {
  return (
    <Card className="overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            {subtitle}
          </p>
        </div>
        <BarChart3 size={16} className="shrink-0 text-[var(--accent)]" />
      </div>
      <div className="mt-4">{children}</div>
      <p className="mt-3 border-t border-[var(--line)] pt-3 text-[10px] leading-5 text-[var(--ink-faint)]">
        {summary}
      </p>
    </Card>
  );
}

export function DualLineChart({
  title,
  subtitle,
  points,
  primaryLabel,
  secondaryLabel,
  summary,
}: {
  title: string;
  subtitle: string;
  points: Point[];
  primaryLabel: string;
  secondaryLabel: string;
  summary: string;
}) {
  const scale = useMemo(() => scaled(points), [points]);
  const primary = points.map((point, index) => scale.point(point.y, index));
  const secondary = points.map((point, index) =>
    scale.point(point.secondary ?? 0, index),
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} summary={summary}>
      <svg
        viewBox="0 0 254 146"
        className="h-48 w-full"
        role="img"
        aria-label={`${title}. ${summary}`}
      >
        <title>{title}</title>
        <desc>{summary}</desc>
        <path d="M36 16V118H218" fill="none" stroke="var(--line-strong)" />
        <path
          d={linePath(primary)}
          fill="none"
          stroke="#0b6b4f"
          strokeWidth="2.5"
        />
        <path
          d={linePath(secondary)}
          fill="none"
          stroke="#b06616"
          strokeWidth="2.5"
          strokeDasharray="5 3"
        />
        {points.map((point, index) => {
          const first = primary[index];
          const second = secondary[index];
          return (
            <g key={point.x}>
              <circle
                cx={first.x}
                cy={first.y}
                r="3"
                fill="#0b6b4f"
                tabIndex={0}
              >
                <title>{`${point.x}: ${primaryLabel} ${point.y}`}</title>
              </circle>
              <circle
                cx={second.x}
                cy={second.y}
                r="3"
                fill="#b06616"
                tabIndex={0}
              >
                <title>{`${point.x}: ${secondaryLabel} ${point.secondary}`}</title>
              </circle>
              {(index === 0 ||
                index === points.length - 1 ||
                index === Math.round(points.length / 2)) && (
                <text
                  x={first.x}
                  y="137"
                  textAnchor="middle"
                  fontSize="8"
                  fill="currentColor"
                >
                  {point.x.slice(-3)}
                </text>
              )}
            </g>
          );
        })}
        <text x="38" y="10" fontSize="8" fill="currentColor">
          {scale.max.toFixed(1)}
        </text>
        <text x="10" y="117" fontSize="8" fill="currentColor">
          {scale.min.toFixed(1)}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[var(--ink-muted)]">
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
          {primaryLabel}
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--amber)]" />
          {secondaryLabel}
        </span>
      </div>
    </ChartFrame>
  );
}

export function GroupLineChart({
  title,
  subtitle,
  points,
  summary,
}: {
  title: string;
  subtitle: string;
  points: Point[];
  summary: string;
}) {
  const groups = [...new Set(points.map((point) => point.group ?? "Series"))];
  const scale = scaled(points);
  const labels = [...new Set(points.map((point) => point.x))];
  return (
    <ChartFrame title={title} subtitle={subtitle} summary={summary}>
      <svg
        viewBox="0 0 254 146"
        className="h-48 w-full"
        role="img"
        aria-label={`${title}. ${summary}`}
      >
        <title>{title}</title>
        <desc>{summary}</desc>
        <path d="M36 16V118H218" fill="none" stroke="var(--line-strong)" />
        {groups.map((group, groupIndex) => {
          const groupPoints = points
            .filter((point) => point.group === group)
            .map((point) => ({
              ...scale.point(point.y, labels.indexOf(point.x), labels.length),
              detail: point,
            }));
          return (
            <g key={group}>
              <path
                d={linePath(groupPoints)}
                fill="none"
                stroke={palette[groupIndex % palette.length]}
                strokeWidth="2"
              />
              {groupPoints.map((point) => (
                <circle
                  key={`${group}-${point.detail.x}`}
                  cx={point.x}
                  cy={point.y}
                  r="2.7"
                  fill={palette[groupIndex % palette.length]}
                  tabIndex={0}
                >
                  <title>{`${group}, ${point.detail.x}: wellbeing ${point.detail.y}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((label, index) => (
          <text
            key={label}
            x={scale.point(scale.min, index, labels.length).x}
            y="137"
            textAnchor="middle"
            fontSize="8"
            fill="currentColor"
          >
            {label.slice(-2)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--ink-muted)]">
        {groups.map((group, index) => (
          <span key={group}>
            <i
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            {group}
          </span>
        ))}
      </div>
    </ChartFrame>
  );
}

export function ScatterChart({
  title,
  subtitle,
  points,
  xLabel,
  yLabel,
  summary,
}: {
  title: string;
  subtitle: string;
  points: Point[];
  xLabel: string;
  yLabel: string;
  summary: string;
}) {
  const xValues = points.map((point) => Number(point.x));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...points.map((point) => point.y));
  const yMax = Math.max(...points.map((point) => point.y));
  const x = (value: number) =>
    inner.left +
    ((value - xMin) / Math.max(xMax - xMin, 1)) * (inner.right - inner.left);
  const y = (value: number) =>
    inner.bottom -
    ((value - yMin) / Math.max(yMax - yMin, 0.1)) * (inner.bottom - inner.top);
  const groups = [...new Set(points.map((point) => point.group ?? "Sample"))];
  return (
    <ChartFrame title={title} subtitle={subtitle} summary={summary}>
      <svg
        viewBox="0 0 254 146"
        className="h-48 w-full"
        role="img"
        aria-label={`${title}. ${summary}`}
      >
        <title>{title}</title>
        <desc>{summary}</desc>
        <path d="M36 16V118H218" fill="none" stroke="var(--line-strong)" />
        {points.map((point, index) => (
          <circle
            key={`${point.x}-${index}`}
            cx={x(Number(point.x))}
            cy={y(point.y)}
            r="4"
            fill={
              palette[groups.indexOf(point.group ?? "Sample") % palette.length]
            }
            tabIndex={0}
          >
            <title>{`${point.label ?? point.group ?? "Observation"}: ${xLabel} ${point.x}, ${yLabel} ${point.y}`}</title>
          </circle>
        ))}
        <text
          x="127"
          y="144"
          textAnchor="middle"
          fontSize="8"
          fill="currentColor"
        >
          {xLabel}
        </text>
        <text
          transform="rotate(-90 9 68)"
          x="9"
          y="68"
          textAnchor="middle"
          fontSize="8"
          fill="currentColor"
        >
          {yLabel}
        </text>
        <text x="36" y="130" fontSize="8" fill="currentColor">
          {xMin.toFixed(1)}
        </text>
        <text x="207" y="130" fontSize="8" fill="currentColor">
          {xMax.toFixed(1)}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--ink-muted)]">
        {groups.map((group, index) => (
          <span key={group}>
            <i
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            {group}
          </span>
        ))}
      </div>
    </ChartFrame>
  );
}

export function CoefficientChart({
  includeWorkload,
  includeMonth,
  standardise,
}: {
  includeWorkload: boolean;
  includeMonth: boolean;
  standardise: boolean;
}) {
  const estimates = flexibleTeachingEstimates();
  const scale = standardise ? 0.5 : 1;
  const rows = [
    {
      label: "OLS",
      estimate: estimates.ols.beta * scale,
      low: estimates.ols.low * scale,
      high: estimates.ols.high * scale,
    },
    {
      label: "Fixed Effects",
      estimate: estimates.fe.beta * scale,
      low: estimates.fe.low * scale,
      high: estimates.fe.high * scale,
    },
  ];
  const all = rows.flatMap((row) => [row.low, row.high, 0]);
  const min = Math.min(...all, -0.1);
  const max = Math.max(...all, 0.1);
  const x = (value: number) =>
    38 + ((value - min) / Math.max(max - min, 0.1)) * 176;
  return (
    <ChartFrame
      title="OLS and Fixed Effects coefficient comparison"
      subtitle="Remote days coefficient; intervals are simple teaching-calculation intervals."
      summary={`Controls displayed: workload ${includeWorkload ? "included" : "hidden"}; month effects ${includeMonth ? "included in Fixed Effects" : "not shown"}. Rounded values avoid false precision.`}
    >
      <svg
        viewBox="0 0 254 116"
        className="h-44 w-full"
        role="img"
        aria-label="OLS and Fixed Effects coefficient comparison"
      >
        <title>OLS and Fixed Effects coefficient comparison</title>
        <desc>
          Dots show the remote days coefficient. Horizontal lines show simple
          teaching-calculation intervals.
        </desc>
        <path
          d={`M${x(0)} 14V99`}
          stroke="var(--line-strong)"
          strokeDasharray="4 3"
        />
        {rows.map((row, index) => {
          const y = 38 + index * 42;
          return (
            <g key={row.label}>
              <text x="4" y={y + 4} fontSize="9" fill="currentColor">
                {row.label}
              </text>
              <path
                d={`M${x(row.low)} ${y}H${x(row.high)}`}
                stroke="#0b6b4f"
                strokeWidth="3"
              />
              <circle
                cx={x(row.estimate)}
                cy={y}
                r="5"
                fill="#0b6b4f"
                tabIndex={0}
              >
                <title>{`${row.label}: ${row.estimate.toFixed(2)}; interval ${row.low.toFixed(2)} to ${row.high.toFixed(2)}`}</title>
              </circle>
              <text
                x={x(row.estimate)}
                y={y - 10}
                textAnchor="middle"
                fontSize="8"
                fill="currentColor"
              >
                {row.estimate.toFixed(2)}
              </text>
            </g>
          );
        })}
        <text x="38" y="110" fontSize="8" fill="currentColor">
          {min.toFixed(1)}
        </text>
        <text x="208" y="110" fontSize="8" fill="currentColor">
          {max.toFixed(1)}
        </text>
      </svg>
    </ChartFrame>
  );
}

export function BarComparisonChart({
  title,
  subtitle,
  values,
  summary,
}: {
  title: string;
  subtitle: string;
  values: Array<{ label: string; value: number; color?: string }>;
  summary: string;
}) {
  const max = Math.max(...values.map((value) => Math.abs(value.value)), 1);
  return (
    <ChartFrame title={title} subtitle={subtitle} summary={summary}>
      <svg
        viewBox="0 0 254 146"
        className="h-48 w-full"
        role="img"
        aria-label={`${title}. ${summary}`}
      >
        <title>{title}</title>
        <desc>{summary}</desc>
        {values.map((item, index) => {
          const height = (Math.abs(item.value) / max) * 88;
          const x = 45 + index * (165 / values.length);
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={112 - height}
                width={Math.min(28, 120 / values.length)}
                height={height}
                rx="3"
                fill={item.color ?? "#0b6b4f"}
                tabIndex={0}
              >
                <title>{`${item.label}: ${item.value.toFixed(1)}`}</title>
              </rect>
              <text
                x={x + Math.min(28, 120 / values.length) / 2}
                y="126"
                textAnchor="middle"
                fontSize="7"
                fill="currentColor"
              >
                {item.label}
              </text>
              <text
                x={x + Math.min(28, 120 / values.length) / 2}
                y={108 - height}
                textAnchor="middle"
                fontSize="8"
                fill="currentColor"
              >
                {item.value.toFixed(1)}
              </text>
            </g>
          );
        })}
        <path d="M36 112H218" stroke="var(--line-strong)" />
      </svg>
    </ChartFrame>
  );
}

export function UnavailableChart({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <Card className="flex min-h-64 flex-col justify-center border-dashed p-5">
      <CircleAlert className="text-[var(--amber)]" size={22} />
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{detail}</p>
      <p className="mt-4 text-[10px] text-[var(--ink-faint)]">
        The lab does not invent a series that the fixed teaching sample does not
        contain.
      </p>
    </Card>
  );
}

export function EvidenceResults({
  project,
  includeWorkload,
  includeMonth,
  standardise,
}: {
  project: EvidenceProject;
  includeWorkload: boolean;
  includeMonth: boolean;
  standardise: boolean;
}) {
  if (project.slug === "flexible-work-wellbeing") {
    const trajectories = project.sampleRows.map((row) => ({
      x: String(row.month),
      y: Number(row.wellbeing_0_10),
      group: String(row.worker_id),
    }));
    const scatter = project.sampleRows.map((row) => ({
      x: String(row.remote_days_week),
      y: Number(row.wellbeing_0_10),
      group: String(row.worker_id),
      label: `${row.worker_id} · ${row.month}`,
    }));
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <GroupLineChart
          title="Worker trajectories by month"
          subtitle="Wellbeing score, 0–10"
          points={trajectories}
          summary="Each line is a pseudonymous worker in the fixed synthetic teaching panel."
        />
        <ScatterChart
          title="Remote days versus wellbeing"
          subtitle="Grouped by worker"
          points={scatter}
          xLabel="remote days/week"
          yLabel="wellbeing, 0–10"
          summary="Points are fixed teaching observations, not respondent-level survey evidence."
        />
        <div className="lg:col-span-2">
          <CoefficientChart
            includeWorkload={includeWorkload}
            includeMonth={includeMonth}
            standardise={standardise}
          />
        </div>
      </div>
    );
  }
  if (project.slug === "restaurant-demand-food-waste") {
    const demand = project.sampleRows.map((row) => ({
      x: String(row.day),
      y: Number(row.forecast_meals),
      secondary: Number(row.actual_meals),
    }));
    const waste = project.sampleRows.map((row) => ({
      x: String(row.order_qty),
      y: Number(row.waste_qty),
      label: `Day ${row.day}`,
    }));
    const profit = project.sampleRows.map((row) => ({
      label: `D${row.day}`,
      value: restaurantProfit(row),
      color: Number(row.waste_qty) > 10 ? "#b06616" : "#0b6b4f",
    }));
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <DualLineChart
          title="Predicted versus actual demand"
          subtitle="Meals by service day"
          points={demand}
          primaryLabel="forecast"
          secondaryLabel="actual"
          summary="The preview shows the fixed 12-day teaching sample."
        />
        <ScatterChart
          title="Order quantity versus waste"
          subtitle="Perishable units ordered and leftovers"
          points={waste}
          xLabel="order quantity"
          yLabel="waste units"
          summary="This operational association does not identify an intervention effect."
        />
        <div className="lg:col-span-2">
          <BarComparisonChart
            title="One-period profit by service day"
            subtitle="Price, cost and salvage values are fixed in the teaching sample."
            values={profit}
            summary="No insurance-coverage variable is present, so an insured comparison is intentionally not shown."
          />
        </div>
      </div>
    );
  }
  const timeSeries = project.sampleRows.map((row) => ({
    x: String(row.month),
    y: Number(row.oil_price_index),
    secondary: Number(row.inflation_yoy_pct) * 25,
  }));
  const lag = project.sampleRows.slice(1).map((row, index) => ({
    x: String(project.sampleRows[index].oil_log_change_pct),
    y: Number(row.inflation_yoy_pct),
    label: String(row.month),
  }));
  const changes = project.sampleRows.map((row) => ({
    label: String(row.month).slice(-2),
    value: Number(row.oil_log_change_pct),
    color: Number(row.oil_log_change_pct) >= 0 ? "#b06616" : "#2c68aa",
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DualLineChart
        title="Oil price and headline inflation"
        subtitle="Oil index and scaled inflation line for shared visual comparison"
        points={timeSeries}
        primaryLabel="oil index"
        secondaryLabel="inflation ×25"
        summary="The two series have different units; inflation is scaled only to make co-movement visible."
      />
      <ScatterChart
        title="Lagged oil change and inflation"
        subtitle="Prior month oil log change against current headline inflation"
        points={lag}
        xLabel="prior oil change, %"
        yLabel="headline inflation, %"
        summary="A visual association in 11 fixed teaching observations is not an identified pass-through estimate."
      />
      <div className="lg:col-span-2">
        <BarComparisonChart
          title="Monthly oil log changes"
          subtitle="Positive and negative changes in the documented synthetic series"
          values={changes}
          summary="Core inflation and cross-country data are not supplied in this teaching sample, so they are not fabricated here."
        />
      </div>
    </div>
  );
}
