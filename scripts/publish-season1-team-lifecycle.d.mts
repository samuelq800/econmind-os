export function publishSeason1TeamLifecycle(input: {
  request: (query: string, readOnly: boolean) => Promise<unknown>;
  migration: string;
  verification: string;
}): Promise<"already-installed" | "published">;
