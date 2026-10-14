export const PROJECT: string;
export const pendingQuery: string;
export function inspectBatch(rows: unknown): {
  ids: string[];
  count: number;
  fingerprint: string;
};
export function approvalSql(template: string, ids: string[]): string;
export function verificationQuery(ids: string[]): string;
export function approvePending(options: {
  request: (query: string, readOnly: boolean) => Promise<unknown>;
  mode: "preview" | "approve";
  expectedFingerprint?: string;
  template: string;
}): Promise<{
  mode: string;
  pending?: number;
  fingerprint?: string;
  accepted?: number;
  remainingPending?: number;
  receipt?: unknown;
  verified?: boolean;
  result?: unknown;
}>;
