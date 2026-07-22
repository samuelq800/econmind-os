import {
  ArrowLeftRight,
  Atom,
  BrainCircuit,
  ChartNoAxesCombined,
  Factory,
  Fence,
  FlaskConical,
  Globe2,
  Landmark,
  Scale,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ModelIconKey } from "@/lib/models/registry";

export const MODEL_ICONS: Record<ModelIconKey, LucideIcon> = {
  market: ChartNoAxesCombined,
  policy: Landmark,
  controls: Fence,
  elasticity: ArrowLeftRight,
  externality: Atom,
  monopoly: Factory,
  ppf: TrendingUp,
  macro: Globe2,
  trade: Scale,
  behavioral: BrainCircuit,
  sandbox: FlaskConical,
};
