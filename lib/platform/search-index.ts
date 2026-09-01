export type SearchSourceItem = {
  href: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
};

export type SearchSourceSection = SearchSourceItem & {
  children: readonly SearchSourceItem[];
};

export type SearchSourceModel = {
  route: string;
  title: string;
  shortTitle?: string;
  description?: string;
  category?: string;
  concepts?: readonly string[];
};

export type GlobalSearchEntry = {
  href: string;
  label: string;
  description: string;
  group: string;
  kind: "section" | "feature" | "model";
  keywords: readonly string[];
  searchText: string;
};

type SearchEntryCandidate = Omit<
  GlobalSearchEntry,
  "keywords" | "searchText"
> & {
  keywords?: readonly (string | undefined)[];
};

export function normaliseSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseHref(href: string) {
  const trimmed = href.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash === "/" ? "/" : withLeadingSlash.replace(/\/+$/, "");
}

function searchableText(entry: Omit<GlobalSearchEntry, "searchText">) {
  return normaliseSearchText(
    [
      entry.label,
      entry.description,
      entry.group,
      entry.href,
      ...entry.keywords,
    ].join(" "),
  );
}

/**
 * Builds the global search index from the same registries that render product
 * navigation and model pages. A route is stored once even when it is both a
 * section root and a child destination; the duplicate metadata becomes search
 * keywords instead of a duplicate result.
 */
export function buildGlobalSearchIndex(
  sections: readonly SearchSourceSection[],
  models: readonly SearchSourceModel[] = [],
) {
  const entriesByHref = new Map<string, GlobalSearchEntry>();

  const upsert = (candidate: SearchEntryCandidate) => {
    const href = normaliseHref(candidate.href);
    const existing = entriesByHref.get(href);
    const keywords = Array.from(
      new Set(
        [
          ...(existing?.keywords ?? []),
          ...(candidate.keywords ?? []),
          existing?.label,
          existing?.description,
          existing?.group,
          candidate.label,
          candidate.description,
          candidate.group,
        ].filter((value): value is string => Boolean(value?.trim())),
      ),
    );

    const entry: Omit<GlobalSearchEntry, "searchText"> = existing
      ? {
          ...existing,
          keywords,
        }
      : {
          href,
          label: candidate.label,
          description: candidate.description,
          group: candidate.group,
          kind: candidate.kind,
          keywords,
        };

    entriesByHref.set(href, { ...entry, searchText: searchableText(entry) });
  };

  for (const section of sections) {
    const primaryChild = section.children.find(
      (child) => normaliseHref(child.href) === normaliseHref(section.href),
    );

    upsert({
      href: section.href,
      label: primaryChild?.label ?? section.label,
      description: primaryChild?.description ?? section.description ?? "",
      group: section.label,
      kind: "section",
      keywords: [
        section.label,
        section.description,
        ...(section.keywords ?? []),
        ...(primaryChild?.keywords ?? []),
      ],
    });

    for (const child of section.children) {
      if (normaliseHref(child.href) === normaliseHref(section.href)) continue;
      upsert({
        href: child.href,
        label: child.label,
        description: child.description ?? "",
        group: section.label,
        kind: "feature",
        keywords: child.keywords,
      });
    }
  }

  for (const model of models) {
    upsert({
      href: model.route,
      label: model.title,
      description: model.description ?? "",
      group: model.category ? `Models · ${model.category}` : "Models",
      kind: "model",
      keywords: [model.shortTitle, ...(model.concepts ?? [])],
    });
  }

  return Array.from(entriesByHref.values());
}

/** Keeps model routes inside a currently visible navigation area. This makes a
 * disabled Models/Lab feature disappear from search without a second flag map. */
export function filterModelsForSearch(
  sections: readonly SearchSourceSection[],
  models: readonly SearchSourceModel[],
) {
  const visibleHrefs = new Set(
    sections.flatMap((section) => [
      normaliseHref(section.href),
      ...section.children.map((child) => normaliseHref(child.href)),
    ]),
  );

  return models.filter((model) => {
    const route = normaliseHref(model.route);
    return route.startsWith("/models/")
      ? visibleHrefs.has("/models")
      : visibleHrefs.has(route);
  });
}

export function searchGlobalIndex(
  entries: readonly GlobalSearchEntry[],
  rawQuery: string,
  limit = 10,
) {
  const safeLimit = Math.max(0, Math.floor(limit));
  const query = normaliseSearchText(rawQuery);

  if (!query) {
    return entries
      .filter((entry) => entry.kind === "section")
      .slice(0, safeLimit);
  }

  const tokens = query.split(" ");

  return entries
    .map((entry, order) => {
      if (!tokens.every((token) => entry.searchText.includes(token)))
        return null;

      const label = normaliseSearchText(entry.label);
      const group = normaliseSearchText(entry.group);
      const href = normaliseSearchText(entry.href);
      const labelWords = label.split(" ");
      const keywords = entry.keywords.map(normaliseSearchText);
      let score =
        entry.kind === "section" ? 6 : entry.kind === "feature" ? 3 : 0;

      if (label === query) score += 160;
      else if (label.startsWith(query)) score += 120;
      else if (label.includes(query)) score += 88;

      if (group === query) score += 48;
      else if (group.startsWith(query)) score += 24;
      if (keywords.includes(query)) score += 140;
      else if (keywords.some((keyword) => keyword.startsWith(query)))
        score += 64;
      if (href.includes(query)) score += 12;

      for (const token of tokens) {
        if (labelWords.includes(token)) score += 28;
        else if (labelWords.some((word) => word.startsWith(token))) score += 18;
        else if (label.includes(token)) score += 10;
      }

      return { entry, order, score };
    })
    .filter(
      (
        result,
      ): result is { entry: GlobalSearchEntry; order: number; score: number } =>
        result !== null,
    )
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, safeLimit)
    .map(({ entry }) => entry);
}
