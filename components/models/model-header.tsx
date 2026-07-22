import { Badge } from "@/components/ui/badge";
import { FavoriteModelButton } from "@/components/models/favorite-model-button";
import type { ModelKey } from "@/lib/supabase/data";

export function ModelHeader({
  eyebrow,
  title,
  description,
  difficulty = "Foundation",
  tags,
  modelKey,
}: {
  eyebrow: string;
  title: string;
  description: string;
  difficulty?: string;
  tags: string[];
  modelKey: ModelKey;
}) {
  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex max-w-5xl flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="max-w-3xl">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--accent)]">{eyebrow}</p>
          <h1 className="text-3xl font-bold tracking-[-.04em] sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)] sm:text-base">{description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge className="bg-[var(--accent-soft)] text-[var(--accent)]">{difficulty}</Badge>
            {tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
          </div>
        </div>
        <FavoriteModelButton modelKey={modelKey} />
      </div>
    </div>
  );
}
