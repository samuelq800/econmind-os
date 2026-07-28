"use client";

import { useEffect, useRef, useState } from "react";
import { describeParameterChange, type ModelParameterChange, type SupportedModelKey } from "@/lib/models/change-tracking";

type ParameterValue = number | string | boolean | undefined;
const parameterValue = (value: unknown): ParameterValue => typeof value === "number" || typeof value === "string" || typeof value === "boolean" ? value : undefined;

/**
 * Records the last meaningful control update without sending slider traffic to a
 * server. Numeric changes smaller than a relative floating-point tolerance are ignored.
 */
export function useParameterChange(parameters: Record<string, unknown>, modelKey?: SupportedModelKey) {
  const previous = useRef(parameters);
  const order = useRef(0);
  const [lastChanged, setLastChanged] = useState<ModelParameterChange | null>(null);
  const signature = JSON.stringify(parameters);

  useEffect(() => {
    const changed = Object.keys(parameters).find((key) => {
      const before = parameterValue(previous.current[key]);
      const after = parameterValue(parameters[key]);
      if (typeof before === "number" && typeof after === "number") return Math.abs(after - before) > Math.max(1e-7, Math.abs(before) * 1e-6);
      return before !== after;
    });
    if (changed) {
      const entry = describeParameterChange({
        modelKey,
        parameterKey: changed,
        previousValue: parameterValue(previous.current[changed]) ?? 0,
        currentValue: parameterValue(parameters[changed]) ?? 0,
        updateOrder: ++order.current,
      });
      if (entry) setLastChanged(entry);
    }
    previous.current = parameters;
  }, [signature, modelKey, parameters]);
  return lastChanged;
}

/** @deprecated Prefer useParameterChange when rendering explanations. */
export function useRecentParameter(parameters: Record<string, unknown>) {
  return useParameterChange(parameters)?.parameterKey ?? null;
}
