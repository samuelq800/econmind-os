import { MODEL_REGISTRY } from "@/lib/models/registry";
import { createStandardModelDescriptor } from "@/lib/models/contract";

export const STANDARD_MODEL_CATALOG = MODEL_REGISTRY.map(createStandardModelDescriptor);

export function getStandardModel(modelId: string) {
  return STANDARD_MODEL_CATALOG.find((model) => model.id === modelId) ?? null;
}
