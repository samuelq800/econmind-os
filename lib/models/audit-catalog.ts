export type ModelAuditRecord = { model: string; knownAnswers: boolean; boundaryCases: boolean; invariants: boolean; numericalStability: boolean; invalidInputs: boolean };

/** Development-only audit index. The detailed assertions live in the Vitest suites. */
export const MODEL_AUDIT_CATALOG: ModelAuditRecord[] = [
  { model: "Supply & Demand", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Indirect Tax & Subsidy", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Price Controls", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Elasticity", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Externalities", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Monopoly", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "PPF", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "AD–AS", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "IS–LM", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Phillips Curve", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Solow Growth", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Lorenz & Gini", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Strategic Interaction", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Cournot", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
  { model: "Economic Sandbox", knownAnswers: true, boundaryCases: true, invariants: true, numericalStability: true, invalidInputs: true },
];
