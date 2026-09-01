import { AVAILABLE_MODELS } from "@/lib/models/registry";
import { availableNavigationSections } from "@/lib/platform/feature-flags";
import {
  buildGlobalSearchIndex,
  filterModelsForSearch,
} from "@/lib/platform/search-index";
import { SIMULATION_NAVIGATION_ITEMS } from "@/lib/platform/simulation-navigation";

const navigationSections = availableNavigationSections();
const searchableSections = navigationSections.map((section) =>
  section.id === "simulation"
    ? {
        ...section,
        children: [
          ...section.children,
          ...SIMULATION_NAVIGATION_ITEMS.map(
            ({ href, label, description }) => ({
              href,
              label,
              description,
            }),
          ),
        ],
      }
    : section,
);
const visibleModels = filterModelsForSearch(
  searchableSections,
  AVAILABLE_MODELS,
);

/** Loaded lazily by the global search so the full model catalog stays out of
 * the initial navigation bundle. */
export const GLOBAL_SEARCH_INDEX = buildGlobalSearchIndex(
  searchableSections,
  visibleModels,
);
