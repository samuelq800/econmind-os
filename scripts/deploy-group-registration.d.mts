export const PROJECT: string;
export const MIGRATION_SHA256: string;
export function fingerprint(value: Record<string, unknown>): string;
export function assertCodeHash(value: unknown): string;
