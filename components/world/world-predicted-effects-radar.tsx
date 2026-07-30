"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  buildWorldEffectAxes,
  type PolicyEffectPreview,
  type WorldCountrySnapshot,
} from "@/lib/economics/continuous-world/predicted-effects";

export function WorldPredictedEffectsRadar({
  country,
  policy,
  change,
}: {
  country: WorldCountrySnapshot;
  policy?: PolicyEffectPreview | null;
  change?: number;
}) {
  const data = buildWorldEffectAxes(country, policy, change).map((axis) => ({
    dimension: axis.label,
    current: axis.current,
    proposed: axis.preview,
  }));

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--line)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">
          Live local preview
        </p>
        <h2 className="mt-1 text-lg font-bold">Predicted effects</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          {policy
            ? `Moving ${policy.id
                .replace(/^POL-[A-Z]+-/, "")
                .replaceAll("-", " ")
                .toLowerCase()} updates this six-dimensional preview instantly.`
            : "Choose a policy instrument to see its calibrated directional preview."}
        </p>
      </div>
      <div className="h-[340px] p-3 sm:p-5">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="68%">
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "var(--ink-muted)", fontSize: 10 }}
            />
            <Radar
              name="Current country state"
              dataKey="current"
              stroke="var(--ink-faint)"
              fill="var(--ink-faint)"
              fillOpacity={0.08}
              strokeDasharray="4 4"
            />
            <Radar
              name="Proposed policy package"
              dataKey="proposed"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.22}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(value) => [value, "Directional index"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="border-t border-[var(--line)] px-4 py-3 text-[10px] leading-5 text-[var(--ink-faint)]">
        The preview aggregates the calibrated 13-effect policy vector and
        current country state. 100 is neutral; it is directional teaching
        guidance, not a settled outcome. Slider changes remain local until you
        publish.
      </p>
    </Card>
  );
}
