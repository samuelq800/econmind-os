import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  collectSnapshotKeyMetadata,
  metadataFingerprint,
  verifyMetadataLock,
  METADATA_CONFIRMATION,
  METADATA_AUTHORIZATION_ID,
  METADATA_URL,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-snapshot-key-metadata.mjs";
import {
  snapshotPublisherKeyMetadata,
  SNAPSHOT_PROJECT_REF,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-source-snapshot-transport.mjs";
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
async function context() {
  return {
    lock: `METADATA_GO:${await metadataFingerprint()}`,
    confirmation: METADATA_CONFIRMATION,
    authorizationId: METADATA_AUTHORIZATION_ID,
    projectRef: SNAPSHOT_PROJECT_REF,
    repository: "samuelq800/econmind-os",
    ref: "refs/heads/main",
    runAttempt: "1",
    sha: "9d1207921a5f2715268d9f98547ef81bd8775e08",
    managementToken: "synthetic-management-only",
  };
}
describe("metadata-only candidate, mock HTTP only", () => {
  it("allowlists aggregate outputs even if reveal=false includes unexpected sensitive values", async () => {
    const sentinel = "synthetic-response-must-not-escape";
    const entries = [
      { type: "legacy", name: "service_role", id: sentinel, api_key: sentinel },
      {
        type: "secret",
        name: sentinel,
        secret_jwt_template: { role: "service_role", private: sentinel },
        api_key: null,
      },
      { type: "publishable", name: "service_role", api_key: sentinel },
      { type: null, name: sentinel },
      { name: sentinel },
      { type: sentinel, name: sentinel, api_key: 5 },
    ];
    const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(METADATA_URL);
      expect(url.endsWith("?reveal=false")).toBe(true);
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      expect(init.credentials).toBe("omit");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return json(entries);
    });
    const receipt = await collectSnapshotKeyMetadata(await context(), {
      fetchRequest,
    });
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(receipt.status).toBe("METADATA_ONLY_COLLECTED_NOT_RELEASE_GO");
    expect(receipt.metadata).toEqual({
      total_entries: 6,
      types: {
        legacy: 1,
        secret: 1,
        publishable: 1,
        null: 1,
        missing: 1,
        other: 1,
      },
      field_presence_counts: {
        api_key: 4,
        id: 1,
        type: 5,
        name: 6,
        secret_jwt_template: 1,
      },
      api_key_shape_counts: { string: 2, null: 1, missing: 2, other: 1 },
      known_role_match_counts: {
        legacy_name_service_role: 1,
        secret_template_service_role: 1,
        existing_selector_candidates: 2,
      },
    });
    expect(JSON.stringify(receipt)).not.toContain(sentinel);
    expect(JSON.stringify(receipt)).not.toContain("synthetic-management-only");
    expect(receipt.key_selection).toBe("NOT_RUN");
    expect(receipt.storage_calls).toBe(0);
    expect(receipt.original_failure_root_cause).toBe("NOT_EVIDENCED");
  });
  it.each([
    ["lock", ""],
    ["lock", "RELEASE_GO:wrong"],
    ["lock", "PREFLIGHT_GO:wrong"],
    ["lock", "METADATA_GO:wrong"],
    ["confirmation", "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE"],
    ["authorizationId", "wrong"],
    ["projectRef", "other"],
    ["repository", "other"],
    ["ref", "refs/heads/candidate"],
    ["runAttempt", "2"],
    ["sha", "invalid"],
    ["managementToken", ""],
  ])("rejects %s guard drift before any HTTP (%#)", async (field, value) => {
    const fetchRequest = vi.fn();
    const input = { ...(await context()), [field]: value };
    await expect(
      collectSnapshotKeyMetadata(input, { fetchRequest }),
    ).rejects.toThrow("SNAPSHOT_METADATA_DIAGNOSTIC_HOLD");
    expect(fetchRequest).not.toHaveBeenCalled();
  });
  it("rejects using exact existing publication fingerprint instead of independent metadata fingerprint", async () => {
    const input = await context();
    input.lock =
      "METADATA_GO:b579c5c7dcfe806ea9c39b842d9cec60b023d9d972ebb3e1b1f3d94b80dedba0";
    await expect(verifyMetadataLock(input)).rejects.toThrow("DIAGNOSTIC_HOLD");
  });
  it.each([
    [[], 0],
    [[{ type: "secret", secret_jwt_template: null }], 0],
    [[{ type: "legacy", name: "service_role", api_key: null }], 1],
    [
      [
        { type: "legacy", name: "service_role" },
        { type: "secret", secret_jwt_template: { role: "service_role" } },
      ],
      2,
    ],
  ])(
    "reports shape/candidate count only, never selects a key (%#)",
    (entries, count) => {
      expect(
        snapshotPublisherKeyMetadata(entries).known_role_match_counts
          .existing_selector_candidates,
      ).toBe(count);
    },
  );
  it("preserves the original candidate predicate across 120 metadata combinations", () => {
    let checked = 0;
    for (const type of [
      undefined,
      null,
      "legacy",
      "publishable",
      "secret",
      "unknown",
    ])
      for (const name of [undefined, "service_role", "anon", "custom"])
        for (const template of [
          undefined,
          null,
          {},
          { role: "anon" },
          { role: "service_role" },
        ]) {
          const item = { type, name, secret_jwt_template: template };
          const original =
            (item.type === "secret" &&
              item.secret_jwt_template?.role === "service_role") ||
            (item.name === "service_role" && item.type !== "publishable");
          expect(
            snapshotPublisherKeyMetadata([item]).known_role_match_counts
              .existing_selector_candidates,
          ).toBe(original ? 1 : 0);
          checked++;
        }
    expect(checked).toBe(120);
  });
  it.each([
    [null, "SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID"],
    [{ rows: [] }, "SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID"],
    [[null], "SNAPSHOT_PUBLISHER_KEY_METADATA_SHAPE_INVALID"],
    [
      ["synthetic-private-string"],
      "SNAPSHOT_PUBLISHER_KEY_METADATA_SHAPE_INVALID",
    ],
    [[[]], "SNAPSHOT_PUBLISHER_KEY_METADATA_SHAPE_INVALID"],
    [
      Array.from({ length: 101 }, () => ({})),
      "SNAPSHOT_PUBLISHER_KEY_METADATA_SHAPE_INVALID",
    ],
  ])(
    "fails invalid shape/cap without raw payload or retry (%#)",
    async (entries, code) => {
      const fetchRequest = vi.fn(async () => json(entries));
      const receipt = await collectSnapshotKeyMetadata(await context(), {
        fetchRequest,
      });
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(receipt.status).toBe("METADATA_QUERY_FAILED_STOP_NO_RETRY");
      expect(receipt.code).toBe(code);
      expect(receipt).not.toHaveProperty("metadata");
      expect(JSON.stringify(receipt)).not.toContain("synthetic-private-string");
    },
  );
  it.each([
    () => new Response("synthetic-private-body", { status: 403 }),
    () => new Response("synthetic-private-body", { status: 302 }),
    () =>
      new Response("synthetic-private-body", {
        headers: { "content-type": "text/plain" },
      }),
    () =>
      new Response("invalid synthetic-private-body", {
        headers: { "content-type": "application/json" },
      }),
    () => json("x".repeat(32_769)),
  ])(
    "bounds HTTP/parser failures to one request and a finite receipt (%#)",
    async (response) => {
      const fetchRequest = vi.fn(async () => response());
      const receipt = await collectSnapshotKeyMetadata(await context(), {
        fetchRequest,
      });
      expect(receipt.status).toBe("METADATA_QUERY_FAILED_STOP_NO_RETRY");
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(receipt)).not.toContain("synthetic-private-body");
      expect(receipt).not.toHaveProperty("metadata");
    },
  );
  it("sanitizes arbitrary network errors, including a forged finite-looking error", async () => {
    const fetchRequest = vi.fn(async () => {
      throw new Error("SNAPSHOT_METADATA_PRIVATE_VALUE");
    });
    const receipt = await collectSnapshotKeyMetadata(await context(), {
      fetchRequest,
    });
    expect(receipt.code).toBe("SNAPSHOT_METADATA_REQUEST_FAILED");
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(receipt)).not.toContain("PRIVATE_VALUE");
  });
  it("keeps diagnostic workflow separate with no release phases or key response disk output", () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/diagnose-world-v2-snapshot-key-metadata.yml",
        import.meta.url,
      ),
      "utf8",
    );
    expect(workflow).toContain("WORLD_V2_SNAPSHOT_KEY_METADATA_LOCK");
    expect(workflow).toContain("diagnose-once");
    expect(workflow).not.toMatch(
      /reveal=true|curl |functions deploy|SUPABASE_SECRET|permissions-render|phase:|WORLD_V2_SNAPSHOT_RELEASE_LOCK/u,
    );
  });
});
