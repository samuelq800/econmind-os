export const PROJECT: string;
export const MIGRATION_SHA256: string;
export function fingerprint(value: Record<string, unknown>): string;
export function assertCodeHash(value: unknown): string;
export function runRelease(options: {
  phase: string;
  statePath: string;
  token: string;
  project: string;
  codeHash?: string;
  fetcher?: typeof fetch;
  read?: (path: string, encoding: string) => Promise<string>;
  write?: (
    path: string,
    data: string,
    options: { mode: number; flag: string },
  ) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void>;
