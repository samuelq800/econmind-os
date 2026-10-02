import { expect, it } from "vitest";
// @ts-expect-error The source auditor is a Node ESM module.
import { summarizeSource } from "../scripts/audit-world-v2-existing-edge-source.mjs";

it("records source identity and environment access without emitting source or secret values", async () => {
  const form = new FormData();
  form.append(
    "source",
    new Blob([
      `const password = 'synthetic-never-output'; Deno.env.get('DAILY_BRIEF_CRON_SECRET'); Deno.env.toObject();`,
    ]),
    "supabase/functions/old-function/index.ts",
  );
  const response = new Response(form);
  const report = await summarizeSource(
    `content-type: ${response.headers.get("content-type")}\r\n`,
    Buffer.from(await response.arrayBuffer()),
    "old-function",
    process.cwd(),
  );
  expect(report.files[0].environment_names).toEqual([
    "DAILY_BRIEF_CRON_SECRET",
  ]);
  expect(report.files[0].whole_environment_access).toBe(true);
  expect(JSON.stringify(report)).not.toContain("synthetic-never-output");
  expect(report.files[0].sha256).toMatch(/^[0-9a-f]{64}$/u);
});
