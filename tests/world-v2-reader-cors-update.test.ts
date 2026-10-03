import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  readerUpdateFingerprint,
  verifyUpdateBinding,
  verifyUpdateGuard,
  verifyUpdateSource,
  updatePreimage,
  verifyUpdateRecheck,
  verifyUpdateAfter,
  verifyUpdateOrigin,
  runReaderUpdate,
  UPDATE_SLUG,
  UPDATE_PROJECT,
  UPDATE_ORIGINS,
  UPDATE_AUTHORIZATION_ID,
  UPDATE_CONFIRMATION,
  // @ts-expect-error Node helper has no declarations.
} from "../scripts/world-v2-reader-cors-update.mjs";
// @ts-expect-error Node helper has no declarations.
import { oldFunctionIdentity } from "../scripts/run-world-v2-source-snapshot-release.mjs";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const functionPath = `supabase/functions/${UPDATE_SLUG}`;
const manifest = {
  status: "BOUND_CODE_CANDIDATE",
  world_source_commit: "a".repeat(40),
  world_function_tree: "b".repeat(40),
  world_function_file_count: 25,
  allowed_function_changes: [`${functionPath}/index.ts`],
};
const old = Array.from({ length: 7 }, (_, i) => ({
  id: `synthetic-old-id-${i}`,
  slug: `synthetic-old-${i}`,
  name: `synthetic-old-${i}`,
  version: 1,
  status: "ACTIVE",
  verify_jwt: true,
  ezbr_sha256: hash(`synthetic-bundle-${i}`),
}));
const reader = {
  id: "synthetic-private-reader-id",
  slug: UPDATE_SLUG,
  name: UPDATE_SLUG,
  version: 1,
  status: "ACTIVE",
  verify_jwt: false,
  ezbr_sha256: hash("synthetic-preimage-bundle"),
};
const list = (current = reader) => [...old, current];
const oldHash = hash(JSON.stringify(oldFunctionIdentity(old)));
const next = {
  ...reader,
  version: 2,
  ezbr_sha256: hash("synthetic-after-bundle"),
};
const body = {
  ok: true,
  packageId: "BALANCED_2026_09_28_V1",
  selectionChecksumSha256:
    "88dd44478f97d2e8893a4f11b3aaf96e256bdb13248aca0d08f097fabe10d315",
  sourceSha256:
    "5d493e93dfab1425731191ba7491cce47949d176e4769b33fdca48d2d31dba89",
  sourcePath: "data/countries.json",
  sourceBytes: 146348,
  dataset: "countries",
  dataNature: "OFFICIAL_SELECTED_SOURCE_DATASET",
  numericEncoding: "DECIMAL_STRING_EXACT",
  liveWorldState: false,
  proposalFieldsAreExecuted: false,
  total: 70,
  offset: 0,
  returned: 1,
  items: [{ synthetic: true }],
};
const get = (origin: string, value: unknown = body) =>
  new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      vary: "Origin",
      "access-control-allow-origin": origin,
      "x-world-source-transport": "HASH_PINNED_IMMUTABLE_SOURCE_SNAPSHOT",
    },
  });
const options = (origin: string) =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, HEAD",
      "access-control-allow-headers": "Accept",
    },
  });
async function context() {
  return {
    repository: "samuelq800/econmind-os",
    ref: "refs/heads/main",
    sha: "c".repeat(40),
    runAttempt: "1",
    projectRef: UPDATE_PROJECT,
    managementToken: "synthetic-management-only",
    authorizationId: UPDATE_AUTHORIZATION_ID,
    confirmation: UPDATE_CONFIRMATION,
    lock: `READER_UPDATE_GO:${await readerUpdateFingerprint()}`,
  };
}
async function harness() {
  const functions = [list(), list(), list(next)];
  const listFunctions = vi.fn(async () => functions.shift());
  const deployFunction = vi.fn(async () => {});
  const verifySource = vi.fn();
  const stageSource = vi.fn(async () => {});
  const responses = [
    get(UPDATE_ORIGINS[0]),
    options(UPDATE_ORIGINS[0]),
    get(UPDATE_ORIGINS[1]),
    options(UPDATE_ORIGINS[1]),
  ];
  const request = vi.fn(async () => responses.shift());
  const deps = {
    manifest,
    expectedOldHash: oldHash,
    listFunctions,
    deployFunction,
    verifySource,
    stageSource,
    request,
  };
  return {
    functions,
    responses,
    ...deps,
    context: await context(),
    run: async (ctx?: Awaited<ReturnType<typeof context>>) =>
      runReaderUpdate(ctx ?? (await context()), "/synthetic-world", deps),
  };
}
describe("existing reader update, synthetic offline dependencies only", () => {
  it("binds the exact reviewed A/G combined source, count and function-only path manifest", () => {
    const actual = JSON.parse(
      readFileSync(
        new URL(
          "../scripts/world-v2-reader-cors-update-binding.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(actual).toEqual({
      status: "BOUND_CODE_CANDIDATE",
      world_source_commit: "0ec30a28d19f4ae51d81edad42d0598c356dc127",
      world_function_tree: "28d7ba3e102a7b4efb5cbb74088ed2a0f85f5d5b",
      world_function_file_count: 25,
      allowed_function_changes: [
        `${functionPath}/index.ts`,
        `${functionPath}/lib/official-dataset-source.d.ts`,
        `${functionPath}/lib/official-dataset-source.js`,
        `${functionPath}/lib/official-source-snapshot-reader.d.ts`,
        `${functionPath}/lib/official-source-snapshot-reader.js`,
      ],
    });
    expect(() => verifyUpdateBinding(actual)).not.toThrow();
  });
  it("requires fully bound immutable source before any production operation", async () => {
    const h = await harness();
    const unbound = {
      status: "UNBOUND_HOLD",
      world_source_commit: null,
      world_function_tree: null,
      world_function_file_count: null,
      allowed_function_changes: null,
    };
    expect(() => verifyUpdateBinding(unbound)).toThrow("UNBOUND_HOLD");
    await expect(
      runReaderUpdate(h.context, "/synthetic-world", {
        ...h,
        manifest: unbound,
      }),
    ).rejects.toThrow("UNBOUND_HOLD");
    expect(h.listFunctions).not.toHaveBeenCalled();
    expect(h.deployFunction).not.toHaveBeenCalled();
    expect(() => verifyUpdateBinding(manifest)).not.toThrow();
  });
  it.each([
    ["repository", "wrong/repository"],
    ["ref", "refs/heads/other"],
    ["runAttempt", "2"],
    ["sha", "bad"],
    ["projectRef", "wrong-project"],
    ["managementToken", ""],
    ["authorizationId", "old-authorization"],
    ["confirmation", "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE"],
    ["lock", "RELEASE_GO:old-fingerprint"],
  ])(
    "rejects guard drift %s before metadata or deploy",
    async (field, value) => {
      const h = await harness();
      await expect(h.run({ ...h.context, [field]: value })).rejects.toThrow(
        "HOLD",
      );
      expect(h.listFunctions).not.toHaveBeenCalled();
      expect(h.deployFunction).not.toHaveBeenCalled();
      expect(h.request).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...manifest, world_source_commit: null },
    { ...manifest, world_source_commit: ["a".repeat(40)] },
    { ...manifest, world_source_commit: "0".repeat(40) },
    { ...manifest, world_source_commit: "main" },
    { ...manifest, world_function_tree: null },
    { ...manifest, world_function_tree: ["b".repeat(40)] },
    { ...manifest, world_function_file_count: null },
    { ...manifest, allowed_function_changes: null },
    {
      ...manifest,
      allowed_function_changes: [`${functionPath}/../old-reader/index.ts`],
    },
    {
      ...manifest,
      allowed_function_changes: ["supabase/functions/old-reader/index.ts"],
    },
  ])("rejects unbound/float/out-of-scope source binding", (value) =>
    expect(() => verifyUpdateBinding(value)).toThrow("UNBOUND_HOLD"),
  );
  it("pins every source Git fact and exact reviewed changed paths, with no symlinks", () => {
    const facts: Record<string, string> = {
      "rev-parse HEAD": manifest.world_source_commit,
      "remote get-url origin":
        "https://github.com/samuelq800/econmind-os-world-simulation.git",
      "status --porcelain=v1 --untracked-files=all": "",
      [`rev-parse HEAD:${functionPath}`]: manifest.world_function_tree,
      [`ls-files ${functionPath}`]: Array.from(
        { length: 25 },
        (_, i) => `${functionPath}/file-${i}.js`,
      ).join("\n"),
      [`ls-tree -r HEAD ${functionPath}`]: "100644 blob synthetic\tfile.js",
      [`diff --name-only ae57dc090f736ea17aa9d67b0e1295f10c97e4c6 HEAD -- ${functionPath}`]: `${functionPath}/index.ts`,
    };
    const git = (...args: string[]) => facts[args.join(" ")];
    expect(() =>
      verifyUpdateSource("/synthetic-world", manifest, { git }),
    ).not.toThrow();
    for (const key of Object.keys(facts)) {
      const wrong = {
        ...facts,
        [key]: key.startsWith("ls-tree") ? "120000 blob symlink" : "wrong",
      };
      expect(() =>
        verifyUpdateSource("/synthetic-world", manifest, {
          git: (...args: string[]) => wrong[args.join(" ")],
        }),
      ).toThrow("SOURCE_INVALID");
    }
    expect(() =>
      verifyUpdateSource("/nonexistent-reader-update-test", manifest),
    ).toThrow("SOURCE_INVALID");
  });
  it("performs exactly two preimages, one deployment, one after image and two-origin GET/OPTIONS", async () => {
    const h = await harness();
    const result = await h.run();
    expect(result.status).toBe("READER_CORS_UPDATE_TWO_ORIGINS_VERIFIED");
    expect(result.request_counts).toEqual({
      metadata_list: 3,
      deploy: 1,
      public_get: 2,
      public_options: 2,
      key_acquisition: 0,
      storage_write: 0,
      database: 0,
    });
    expect(h.listFunctions).toHaveBeenCalledTimes(3);
    expect(h.deployFunction).toHaveBeenCalledTimes(1);
    expect(h.request).toHaveBeenCalledTimes(4);
    expect(result.routes.map((r: { origin: string }) => r.origin)).toEqual(
      UPDATE_ORIGINS,
    );
    expect(result.function_evidence).toMatchObject({
      version: 2,
      verify_jwt: false,
      same_reader_id: true,
      old_function_identity_sha256: oldHash,
    });
    expect(JSON.stringify(result)).not.toContain(reader.id);
    expect(JSON.stringify(result)).not.toContain(reader.ezbr_sha256);
    expect(JSON.stringify(result)).not.toContain(h.context.managementToken);
    for (const [url, init] of h.request.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(url).toBe(
        `https://${UPDATE_PROJECT}.supabase.co/functions/v1/${UPDATE_SLUG}/v1/world-data/datasets/countries?limit=1`,
      );
      expect(init.redirect).toBe("error");
      expect(init.credentials).toBe("omit");
      expect(new Headers(init.headers).get("apikey")).toBeNull();
      expect(new Headers(init.headers).get("authorization")).toBeNull();
    }
  });
  it.each([
    { ...reader, name: "old-reader" },
    { ...reader, slug: "old-reader" },
    { ...reader, id: "" },
    { ...reader, version: 2 },
    { ...reader, status: "INACTIVE" },
    { ...reader, verify_jwt: true },
    { ...reader, ezbr_sha256: null },
    { ...reader, ezbr_sha256: "bad" },
  ])(
    "rejects non-v1/exact reader identities with no deploy",
    async (current) => {
      const h = await harness();
      h.functions[0] = list(current as typeof reader);
      const result = await h.run();
      expect(result.status).toBe("READER_UPDATE_BLOCKED_STOP_NO_RETRY");
      expect(h.deployFunction).not.toHaveBeenCalled();
      expect(h.request).not.toHaveBeenCalled();
    },
  );
  it("rejects wrong old-seven hash, duplicates and missing readers before deploying", () => {
    expect(() => updatePreimage(list())).toThrow("OLD_FUNCTION_CHANGED"); // production default cannot accept synthetic old identities
    for (const value of [
      null,
      list().slice(1),
      [...list(), reader],
      [...old.slice(1), old[1], reader],
    ])
      expect(() => updatePreimage(value, oldHash)).toThrow();
  });
  it.each(["id", "ezbr_sha256"])(
    "blocks a drifted second preimage %s without deploy/retry",
    async (field) => {
      const h = await harness();
      h.functions[1] = list({
        ...reader,
        [field]: field === "id" ? "synthetic-replacement-id" : "d".repeat(64),
      });
      const result = await h.run();
      expect(result.failed_stage).toBe("RECHECK");
      expect(h.listFunctions).toHaveBeenCalledTimes(2);
      expect(h.deployFunction).not.toHaveBeenCalled();
    },
  );
  it("does not silently freeze identity drift or changed old-function state", () => {
    const pre = updatePreimage(list(), oldHash);
    expect(() =>
      verifyUpdateRecheck(
        pre,
        list({ ...reader, id: "synthetic-replacement-id" }),
        oldHash,
      ),
    ).toThrow("PREIMAGE_CHANGED");
    expect(() =>
      verifyUpdateAfter(
        pre,
        [...old.slice(1), { ...old[0], version: 2 }, next],
        oldHash,
      ),
    ).toThrow("OLD_FUNCTION_CHANGED");
  });
  it.each([
    { ...next, id: "synthetic-replacement-id" },
    { ...next, version: 1 },
    { ...next, version: 3 },
    { ...next, verify_jwt: true },
    { ...next, status: "INACTIVE" },
    { ...next, ezbr_sha256: reader.ezbr_sha256 },
  ])(
    "after-image mismatch stays UNKNOWN, one deploy and no remote cleanup",
    async (after) => {
      const h = await harness();
      h.functions[2] = list(after);
      const result = await h.run();
      expect(result.status).toBe("READER_UPDATE_OUTCOME_UNKNOWN_STOP_NO_RETRY");
      expect(result.remote_update_may_have_occurred).toBe(true);
      expect(h.deployFunction).toHaveBeenCalledTimes(1);
      expect(h.listFunctions).toHaveBeenCalledTimes(3);
      expect(h.request).not.toHaveBeenCalled();
    },
  );
  it("sanitizes metadata/deploy/network errors and never retries unknown update", async () => {
    const h = await harness();
    h.deployFunction.mockImplementationOnce(async () => {
      throw new Error(h.context.managementToken);
    });
    const result = await h.run();
    expect(result.failed_stage).toBe("DEPLOY");
    expect(result.status).toBe("READER_UPDATE_OUTCOME_UNKNOWN_STOP_NO_RETRY");
    expect(JSON.stringify(result)).not.toContain(h.context.managementToken);
    expect(h.listFunctions).toHaveBeenCalledTimes(2);
    expect(h.deployFunction).toHaveBeenCalledTimes(1);
  });
  it.each(UPDATE_ORIGINS as string[])(
    "preserves exact two-origin source/shape/CORS checks for %s",
    (origin) => {
      expect(
        verifyUpdateOrigin(get(origin), body, options(origin), origin),
      ).toMatchObject({
        origin,
        returned: 1,
        total: 70,
        database_projection: false,
        live_world_state: false,
      });
      for (const wrong of [
        "*",
        "https://evil.example",
        origin + "/",
        UPDATE_ORIGINS.filter((x: string) => x !== origin)[0],
      ])
        expect(() =>
          verifyUpdateOrigin(get(wrong), body, options(origin), origin),
        ).toThrow();
      for (const credentials of ["true", "true, false", "TRUE"]) {
        const response = get(origin);
        response.headers.set("access-control-allow-credentials", credentials);
        expect(() =>
          verifyUpdateOrigin(response, body, options(origin), origin),
        ).toThrow();
      }
      expect(() =>
        verifyUpdateOrigin(
          get(origin),
          { ...body, sourceSha256: "0".repeat(64) },
          options(origin),
          origin,
        ),
      ).toThrow();
      expect(() =>
        verifyUpdateOrigin(
          get(origin),
          { ...body, liveWorldState: true },
          options(origin),
          origin,
        ),
      ).toThrow();
      expect(() =>
        verifyUpdateOrigin(
          get(origin),
          body,
          options(origin),
          "https://evil.example",
        ),
      ).toThrow();
    },
  );
  it.each([401, 403, 546])(
    "stops at failed GET%s without extra requests",
    async (status) => {
      const h = await harness();
      h.responses[0] = new Response("synthetic-private-details", { status });
      const result = await h.run();
      expect(result.status).toBe("READER_UPDATE_OUTCOME_UNKNOWN_STOP_NO_RETRY");
      expect(h.request).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain("synthetic-private-details");
    },
  );
  it("rejects invalid and oversized body without response capture", async () => {
    for (const raw of ["synthetic-private-invalid-json", "x".repeat(262_145)]) {
      const h = await harness();
      h.responses[0] = new Response(raw, {
        headers: get(UPDATE_ORIGINS[0]).headers,
      });
      const result = await h.run();
      expect(result.code).toBe("WORLD_V2_READER_UPDATE_ROUTE_INVALID");
      expect(h.request).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain(raw);
    }
  });
  it("keeps workflow update-only and provides no mutable source or hash CLI overrides", async () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/update-world-v2-reader-cors.yml",
        import.meta.url,
      ),
      "utf8",
    );
    const script = readFileSync(
      new URL("../scripts/world-v2-reader-cors-update.mjs", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("group: supabase-production");
    expect(workflow).toContain(
      "node scripts/world-v2-reader-cors-update.mjs guard",
    );
    expect(workflow).toContain("world-v2-reader-cors-update.mjs source-sha");
    expect(workflow).not.toMatch(
      /world-v2-source-snapshot-release\.mjs|database\/query|secrets set|api-keys|storage\/v1|phase: publish/u,
    );
    expect(script).toContain(
      '["functions", "deploy", UPDATE_SLUG, "--project-ref", UPDATE_PROJECT]',
    );
    expect(script).not.toMatch(
      /--source-ref|--old-function-hash|--project-override|--origin-override/u,
    );
    expect(await readerUpdateFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    await expect(
      verifyUpdateGuard(await context(), { manifest }),
    ).resolves.toBeUndefined();
  });
});
