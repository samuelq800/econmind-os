"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export function MathFormula({
  expression,
  block = false,
  className = "",
}: {
  expression: string;
  block?: boolean;
  className?: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(expression, {
        displayMode: block,
        throwOnError: false,
        strict: "ignore",
        trust: false,
      }),
    [expression, block],
  );
  const Tag = block ? "div" : "span";
  return (
    <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
