"use client";
import { useEffect, useState } from "react";
import type { PolicyHeading } from "@/lib/legal/markdown";

export function PolicyToc({
  headings,
}: {
  headings: readonly PolicyHeading[];
}) {
  const [active, setActive] = useState("");
  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => !!element);
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);
  const contents = (
    <nav aria-label="Document contents">
      {headings
        .filter((heading) => heading.level <= 3)
        .map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            data-level={heading.level}
            aria-current={active === heading.id ? "location" : undefined}
            onClick={(event) => {
              setActive(heading.id);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            {heading.title}
          </a>
        ))}
    </nav>
  );
  return (
    <>
      <details className="policy-toc-mobile">
        <summary>
          In this document{" "}
          <span>
            {headings.filter((heading) => heading.level === 2).length} sections
          </span>
        </summary>
        {contents}
      </details>
      <aside className="policy-toc-desktop">
        <p className="policy-kicker">Document contents</p>
        {contents}
        <a className="policy-back-top" href="#policy-top">
          Back to top ↑
        </a>
      </aside>
    </>
  );
}
