import { MODEL_PARAMETER_DEFINITIONS, sanitizeModelParameters, type FocusedModelKey } from "@/lib/experiments/model-runtime";
import type { AppRole, ExperimentStatus, ParameterPermission } from "@/lib/experiments/types";

export type ExperimentAction = "preview" | "join" | "predict" | "run" | "submit" | "create" | "edit" | "publish" | "review" | "export";

export function canPerformExperimentAction(role: AppRole, action: ExperimentAction, status: ExperimentStatus = "published") {
  if (action === "preview") return status === "published" || role === "teacher";
  if (role === "guest") return false;
  if (role === "student") return ["join", "predict", "run", "submit"].includes(action) && status === "published";
  return ["create", "edit", "publish", "review", "export", "preview"].includes(action);
}

export function validateParameterPermissions(modelKey: FocusedModelKey, permissions: ParameterPermission[]) {
  const definitions = MODEL_PARAMETER_DEFINITIONS[modelKey];
  const byKey = new Map(permissions.map((permission) => [permission.parameterKey, permission]));
  if (byKey.size !== definitions.length) return false;
  return definitions.every((definition) => {
    const permission = byKey.get(definition.key);
    return Boolean(permission)
      && permission!.minimum >= definition.min
      && permission!.maximum <= definition.max
      && permission!.minimum <= permission!.initialValue
      && permission!.initialValue <= permission!.maximum;
  });
}

export function enforceParameterPermissions(modelKey: FocusedModelKey, submitted: Record<string, unknown>, permissions: ParameterPermission[]) {
  if (!validateParameterPermissions(modelKey, permissions)) throw new Error("Invalid experiment parameter permissions.");
  const allowed = new Set(permissions.map((permission) => permission.parameterKey));
  if (Object.keys(submitted).some((key) => !allowed.has(key))) throw new Error("Unknown parameter supplied.");
  const sanitized = sanitizeModelParameters(modelKey, submitted);
  const output: Record<string, number> = {};
  for (const permission of permissions) {
    const value = sanitized[permission.parameterKey];
    if (!permission.editable && Math.abs(value - permission.initialValue) > 1e-9) throw new Error(`Locked parameter modified: ${permission.parameterKey}`);
    if (value < permission.minimum || value > permission.maximum) throw new Error(`Parameter outside teacher range: ${permission.parameterKey}`);
    output[permission.parameterKey] = permission.editable ? value : permission.initialValue;
  }
  return output;
}

export function canViewPrivateReport(input: { viewerId: string | null; studentId: string; teacherId: string; validShareToken?: boolean }) {
  return Boolean(input.validShareToken || (input.viewerId && (input.viewerId === input.studentId || input.viewerId === input.teacherId)));
}
