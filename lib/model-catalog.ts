import { MODEL_ICONS } from "@/lib/models/icons";
import { AVAILABLE_MODELS } from "@/lib/models/registry";

// Compatibility adapter for existing pages. The single source of truth is MODEL_REGISTRY.
export const MODEL_CATALOG = AVAILABLE_MODELS.map((model) => ({
  slug: model.route,
  title: model.title,
  shortTitle: model.shortTitle,
  description: model.description,
  difficulty: model.difficulty,
  concepts: [...model.concepts],
  icon: MODEL_ICONS[model.icon],
  number: model.number,
}));
