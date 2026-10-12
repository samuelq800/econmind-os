export function publishReusableTeamNames(input: {
  request: (query: string, readOnly: boolean) => Promise<unknown>;
  migration: string;
  verification: string;
}): Promise<"already-installed" | "published">;
export const PROJECT: string;
export const VERSION: string;
export const MIGRATION: string;
