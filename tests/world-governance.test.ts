import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SIMULATION_DAY_MS,
  WORLD_POLICY_DEFINITIONS,
  WORLD_ROLE_META,
} from "@/lib/world-governance/config";
import {
  buildPolicyForecast,
  lifecycleStrength,
  policyCosts,
  policyDefinition,
  policyLifecycleStatus,
  requiredApprovals,
} from "@/lib/world-governance/simulation";
import { roleToStoredRole } from "@/lib/supabase/world-governance";
import type { PublishedPolicy } from "@/lib/world-governance/types";

const migration = readFileSync(
  "supabase/migrations/20260804000000_world_governance_continuous_upgrade.sql",
  "utf8",
);
const worker = readFileSync(
  "supabase/functions/process-continuous-world/index.ts",
  "utf8",
);

function published(
  status: PublishedPolicy["status"],
  hoursAgo: number,
): PublishedPolicy {
  const definition = policyDefinition("POL-CB-FX-SWAP");
  if (!definition) throw new Error("missing fixture policy");
  return {
    id: "fixture",
    policyId: definition.id,
    countryId: "asterra",
    proposedValue: 3,
    previousValue: 0,
    changedAt: new Date().toISOString(),
    role: "central-bank",
    status,
    publishedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    effectiveStrength: 0,
    fiscalCost: 0,
    reserveCost: 0,
    politicalCost: 0,
    administrativeBurden: 0,
    lifecycle: definition.lifecycle,
    approvalIds: [],
  };
}

describe("World Governance continuous model", () => {
  it("uses the agreed six-office cabinet and absorbs resource instruments into Industry", () => {
    expect(Object.keys(WORLD_ROLE_META)).toEqual([
      "captain",
      "central-bank",
      "finance",
      "trade",
      "industry",
      "social",
    ]);
    expect(Object.values(roleToStoredRole)).not.toContain(
      "research_innovation_minister",
    );
    expect(WORLD_POLICY_DEFINITIONS).toHaveLength(34);
    expect(policyDefinition("POL-RES-STRATEGIC-RESERVE-RELEASE")?.role).toBe(
      "industry",
    );
  });

  it("has distinct lifecycle states and no immediate effect during the configured wait", () => {
    expect(policyLifecycleStatus(published("blocked", 0))).toBe("blocked");
    expect(policyLifecycleStatus(published("cancelled", 0))).toBe("cancelled");
    expect(policyLifecycleStatus(published("announced", 0.1))).toBe("waiting");
    expect(policyLifecycleStatus(published("announced", 2))).toBe("ramping_up");
    expect(policyLifecycleStatus(published("announced", 10))).toBe(
      "full_effect",
    );
    expect(policyLifecycleStatus(published("announced", 60))).toBe("fading");
    expect(policyLifecycleStatus(published("announced", 400))).toBe("expired");
    const fx = policyDefinition("POL-CB-FX-SWAP");
    if (!fx) throw new Error("missing fixture policy");
    expect(lifecycleStrength(fx.lifecycle, new Date().toISOString())).toBe(0);
  });

  it("marks large resource, fiscal or political commitments for Captain review at the doubled thresholds", () => {
    const zone = policyDefinition("POL-IND-SPECIAL-ECONOMIC-ZONE");
    if (!zone) throw new Error("missing fixture policy");
    const costs = policyCosts(zone, zone.max);
    expect(costs.fiscalCost).toBeGreaterThan(4);
    expect(requiredApprovals(zone, zone.max)).toContain("captain");
    const forecast = buildPolicyForecast(zone, zone.max);
    expect(forecast.uncertainty).toContain("confidence");
    expect(forecast.dependencies.length).toBeGreaterThan(0);
  });

  it("keeps a two-real-hour simulation day consistently in browser and worker code", () => {
    expect(SIMULATION_DAY_MS).toBe(7_200_000);
    expect(worker).toContain("const SIMULATION_DAY_MS = 2 * 60 * 60 * 1000");
    expect(worker).toMatch(
      /advanceContinuousWorld\(\s*stateForTick\(row, shocks\),\s*actions,\s*definitions,\s*processedAt,\s*SIMULATION_DAY_MS,?\s*\)/,
    );
  });

  it("persists approvals, contracts and compact reports without a learner rollback snapshot", () => {
    for (const table of [
      "continuous_world_action_approvals",
      "continuous_world_cabinet_proposals",
      "continuous_world_budget_requests",
      "continuous_world_contract_messages",
      "continuous_world_projects",
      "continuous_world_reports",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration).toContain(
      "fiscal_cost > 4 or reserve_use > 20 or political_cost > 40",
    );
    expect(migration).toContain(
      "create or replace function public.apply_unclaimed_world_contract_default",
    );
    expect(migration).toContain("'0 */2 * * *'");
    expect(migration).not.toContain(
      "insert into public.continuous_world_snapshots",
    );
  });
});
