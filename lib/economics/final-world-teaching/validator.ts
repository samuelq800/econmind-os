import { FINAL_WORLD_TEACHING, asArray, asRecord, numeric } from "./catalog";

export type FinalWorldValidation = { valid: boolean; errors: string[]; summary: Record<string, number> };

const percentageTotal = (items: unknown[]) => Math.round(items.reduce<number>((sum, item) => sum + numeric(item), 0) * 1000) / 1000;

/**
 * Guards the data that is embedded in the public learning experience. The
 * checks deliberately validate internal teaching invariants, not real-world
 * claims: every country, route and scenario remains fictional by design.
 */
export function validateFinalWorldTeachingPackage(): FinalWorldValidation {
  const errors: string[] = [];
  const territories = asArray<{ id?: unknown }>(FINAL_WORLD_TEACHING.territoryNetwork.territories);
  const centroids = asRecord(FINAL_WORLD_TEACHING.fictionalWorldMap.territory_centroids);
  const countryIds = new Set(territories.map((item) => typeof item.id === "string" ? item.id : "").filter(Boolean));
  if (countryIds.size !== 12) errors.push("The fictional world must contain exactly twelve territories.");
  for (const country of countryIds) if (!Array.isArray(centroids[country])) errors.push(`Missing map centroid for ${country}.`);

  const routes = asArray<{ id?: unknown; from?: unknown; to?: unknown }>(FINAL_WORLD_TEACHING.tradeRouteGraph.routes);
  if (routes.length < 12) errors.push("The world needs a connected teaching trade network.");
  if (new Set(routes.map((route) => route.id)).size !== routes.length) errors.push("Trade route IDs must be unique.");
  if (routes.some((route) => typeof route.from !== "string" || typeof route.to !== "string")) errors.push("Every route needs two endpoints.");

  const markets = asRecord(FINAL_WORLD_TEACHING.bilateralTradeMatrix.markets);
  for (const [market, raw] of Object.entries(markets)) {
    const definition = asRecord(raw);
    const exports = asArray(definition.export_share_percent);
    const imports = asArray(definition.import_share_percent);
    if (exports.length !== 12 || imports.length !== 12) errors.push(`${market} requires shares for every territory.`);
    if (percentageTotal(exports) !== 100 || percentageTotal(imports) !== 100) errors.push(`${market} import and export shares must each total 100.`);
  }

  const scenarios = asArray(FINAL_WORLD_TEACHING.continuousWorldScenarios.scenarios);
  if (scenarios.length < 7) errors.push("Continuous world needs all supplied resilience scenarios.");
  const stabilityTests = asArray(FINAL_WORLD_TEACHING.stabilityCollapseTests.tests);
  if (!stabilityTests.some((test) => asRecord(test).id === "STAB-06")) errors.push("Recovery scenario is required; collapse must not be permanent.");
  if (asArray(FINAL_WORLD_TEACHING.contractTemplates.templates).length < 8) errors.push("Contract template library is incomplete.");
  if (asArray(FINAL_WORLD_TEACHING.econbenchScenarioLibrary.challenges).length !== 10) errors.push("EconBench requires ten preset challenges.");
  if (asArray(FINAL_WORLD_TEACHING.mechanismArenaScenarios.scenarios).length !== 10) errors.push("Mechanism Arena requires ten preset experiments.");
  if (asArray(FINAL_WORLD_TEACHING.evidenceLabProjects.projects).length !== 3) errors.push("Evidence Lab requires three curated projects.");

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      countries: countryIds.size,
      tradeRoutes: routes.length,
      markets: Object.keys(markets).length,
      continuousScenarios: scenarios.length,
      contracts: asArray(FINAL_WORLD_TEACHING.contractTemplates.templates).length,
      econBenchChallenges: asArray(FINAL_WORLD_TEACHING.econbenchScenarioLibrary.challenges).length,
      mechanisms: asArray(FINAL_WORLD_TEACHING.mechanismArenaScenarios.scenarios).length,
      evidenceProjects: asArray(FINAL_WORLD_TEACHING.evidenceLabProjects.projects).length,
    },
  };
}
