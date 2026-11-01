export interface MinimatchSafetyEvidence {
  readonly legacy: {
    readonly version: string;
    readonly path: string;
    readonly sha256: string;
    readonly copies: readonly { path: string; sha256: string }[];
    readonly hasAggressiveOptimizer: boolean;
    readonly oneToOnePartsMap: boolean;
    readonly globSetCount: number;
    readonly globPartsCount: number;
    readonly normalControls: readonly boolean[];
  };
  readonly modern: {
    readonly version: string;
    readonly path: string;
    readonly generatedPatterns: number;
    readonly requestedLimit: number;
    readonly alternateGeneratedPatterns: number;
    readonly alternateRequestedLimit: number;
    readonly largeNonQuadraticSet: number;
    readonly normalControls: readonly boolean[];
  };
  readonly advisory: string;
  readonly upstreamFix: string;
}
export function inspectMinimatchSafety(): MinimatchSafetyEvidence;
export function checkMinimatchSafety(): MinimatchSafetyEvidence;
