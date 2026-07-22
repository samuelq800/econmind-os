"use client";

import { useEffect, useRef, useState } from "react";

export function useRecentParameter(parameters: Record<string, unknown>) {
  const previous = useRef(parameters);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const signature = JSON.stringify(parameters);
  useEffect(() => {
    const changed = Object.keys(parameters).find((key) => previous.current[key] !== parameters[key]);
    if (changed) setLastChanged(changed);
    previous.current = parameters;
  }, [signature, parameters]);
  return lastChanged;
}
