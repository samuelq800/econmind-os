import {
  listContinuousWorlds,
  listMyContinuousWorldRoles,
  submitContinuousWorldPolicy,
  type ContinuousWorldRecord,
} from "./continuous-world";
import {
  policyCosts,
  policyDefinition,
} from "@/lib/world-governance/simulation";
import type { WorldGovernanceRole } from "@/lib/world-governance/types";

export const roleToStoredRole: Record<WorldGovernanceRole, string> = {
  captain: "country_captain",
  "central-bank": "central_bank_governor",
  finance: "economic_policy_minister",
  trade: "trade_minister",
  industry: "infrastructure_investment_minister",
  social: "social_labour_minister",
};

export type WorldGovernanceAccess = {
  world: ContinuousWorldRecord | null;
  roles: Array<{ countryId: string; role: WorldGovernanceRole }>;
};

const storedRoleToRole = Object.fromEntries(
  Object.entries(roleToStoredRole).map(([role, stored]) => [stored, role]),
) as Record<string, WorldGovernanceRole | undefined>;

/**
 * Browser-safe access layer. It intentionally uses only the publishable
 * Supabase client and the RLS-protected continuous-world RPCs.
 */
export async function loadWorldGovernanceAccess(
  userId?: string | null,
): Promise<WorldGovernanceAccess> {
  const worlds = await listContinuousWorlds();
  const world =
    worlds.find((item) => item.status === "running") ?? worlds[0] ?? null;
  if (!userId || !world) return { world, roles: [] };
  const assignments = await listMyContinuousWorldRoles(userId);
  return {
    world,
    roles: assignments.flatMap((assignment) => {
      const role = storedRoleToRole[assignment.role_type];
      return role ? [{ countryId: assignment.country_key, role }] : [];
    }),
  };
}

export function mayPublishWorldPolicy(
  access: WorldGovernanceAccess,
  countryId: string,
  role: WorldGovernanceRole,
  isSupervisor = false,
) {
  return (
    isSupervisor ||
    access.roles.some(
      (assignment) =>
        assignment.countryId === countryId && assignment.role === role,
    )
  );
}

export async function publishWorldGovernancePolicy(input: {
  worldId: string;
  countryId: string;
  policyId: string;
  value: number;
}) {
  const definition = policyDefinition(input.policyId);
  if (!definition)
    throw new Error(
      "This policy is not present in the active teaching catalogue.",
    );
  const costs = policyCosts(definition, input.value);
  return submitContinuousWorldPolicy({
    worldId: input.worldId,
    countryKey: input.countryId,
    policyId: input.policyId,
    change: input.value,
    metadata: {
      fiscal_cost_pct_gdp: costs.fiscalCost,
      reserve_use_percent: costs.reserveCost,
      political_cost_percent: costs.politicalCost,
    },
  });
}
