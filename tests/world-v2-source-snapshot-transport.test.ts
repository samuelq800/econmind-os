import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import manifest from "./fixtures/world-v2-source-snapshot-transport-manifest.json";
import {
  withEphemeralSnapshotTransport,
  verifyStorageWriteBoundary,
  SNAPSHOT_STORAGE_PERMISSION_SQL,
  SNAPSHOT_BUCKET,
  SNAPSHOT_PREFIX,
  SNAPSHOT_PROJECT_REF,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-source-snapshot-transport.mjs";
const spec = manifest.find(
  (item) => item.source_path === "data/assumptions.json",
)!;
const key = `${SNAPSHOT_PREFIX}/${spec.sha256}.json`;
const bytes = readFileSync(
  new URL(
    "./fixtures/world-v2-source-snapshot-assumptions.json",
    import.meta.url,
  ),
);
const credential = [
  Buffer.from("{}").toString("base64url"),
  Buffer.from(
    JSON.stringify({ ref: SNAPSHOT_PROJECT_REF, role: "service_role" }),
  ).toString("base64url"),
  "synthetic",
].join(".");
const management = "synthetic-management-only";
const modernCredential = "sb_secret_" + "synthetic_mock_only_not_real";
const modernEntry = (
  api_key: unknown = modernCredential,
  extra: Record<string, unknown> = {},
) => ({
  type: "secret",
  name: "synthetic-custom-name",
  secret_jwt_template: { role: "service_role" },
  api_key,
  ...extra,
});
const legacyEntry = (
  api_key: unknown = credential,
  extra: Record<string, unknown> = {},
) => ({
  type: "legacy",
  name: "service_role",
  api_key,
  ...extra,
});
const bucket = {
  id: SNAPSHOT_BUCKET,
  name: SNAPSHOT_BUCKET,
  public: true,
  file_size_limit: 9_000_000,
  allowed_mime_types: ["application/json"],
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
type SnapshotTransport = {
  getBucket(name: string): Promise<typeof bucket | null>;
  createBucket(properties: typeof bucket): Promise<void>;
  listKeys(name: string): Promise<string[]>;
  readObject(name: string, key: string): Promise<Uint8Array | null>;
  createObject(
    name: string,
    key: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: boolean },
  ): Promise<void>;
};
type StoragePolicy = {
  table: string;
  name: string;
  command: string;
  permissive: boolean;
  qual: string | null;
  check: string | null;
  applies_to: string[];
};
function mock() {
  const responses: Response[] = [];
  const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.redirect).toBe("error");
    expect(init.credentials).toBe("omit");
    if (
      url ===
      "https://api.supabase.com/v1/projects/" +
        SNAPSHOT_PROJECT_REF +
        "/api-keys?reveal=true"
    ) {
      expect(new Headers(init.headers).get("authorization")).toBe(
        `Bearer ${management}`,
      );
      return json([
        { name: "service_role", type: "legacy", api_key: credential },
      ]);
    }
    expect(
      url.startsWith(`https://${SNAPSHOT_PROJECT_REF}.supabase.co/storage/v1/`),
    ).toBe(true);
    const headers = new Headers(init.headers);
    if (url.includes("/object/public/")) {
      expect(headers.get("apikey")).toBeNull();
      expect(headers.get("authorization")).toBeNull();
    } else expect(headers.get("apikey")).toBe(credential);
    const response = responses.shift();
    if (!response) throw new Error("UNEXPECTED_REQUEST");
    return response;
  });
  const run = (operation: (transport: SnapshotTransport) => Promise<unknown>) =>
    withEphemeralSnapshotTransport(
      { manifest, managementToken: management, fetchRequest },
      operation,
    );
  return { responses, fetchRequest, run };
}
function evidence(privileges = false) {
  return {
    bucket: SNAPSHOT_BUCKET,
    relations: [
      { name: "buckets", rls: true },
      { name: "objects", rls: true },
    ],
    roles: ["anon", "authenticated"].flatMap((role) =>
      ["buckets", "objects"].map((table) => ({
        role,
        table,
        superuser: false,
        bypass_rls: false,
        owner_privileges: false,
        insert: privileges,
        update: privileges,
        delete: privileges,
        column_insert: privileges,
        column_update: privileges,
      })),
    ),
    policies: [] as StoragePolicy[],
  };
}
describe("scoped real Storage protocol with mock HTTP only", () => {
  it("acquires existing key transiently; permits fixed GET/list/create only; retires on completion", async () => {
    const { run, responses, fetchRequest } = mock();
    let retained: SnapshotTransport | undefined;
    responses.push(
      json(bucket),
      json({ name: SNAPSHOT_BUCKET }, 201),
      json([{ name: SNAPSHOT_PREFIX, id: null }]),
      json([{ name: spec.sha256 + ".json", id: "synthetic-object" }]),
      new Response(bytes, { headers: { "content-type": "application/json" } }),
      json({ key }, 201),
    );
    await run(async (transport) => {
      retained = transport;
      expect(await transport.getBucket(SNAPSHOT_BUCKET)).toEqual(bucket);
      await transport.createBucket(bucket);
      expect(await transport.listKeys(SNAPSHOT_BUCKET)).toEqual([key]);
      expect(await transport.readObject(SNAPSHOT_BUCKET, key)).toEqual(bytes);
      await transport.createObject(SNAPSHOT_BUCKET, key, bytes, {
        contentType: "application/json",
        upsert: false,
      });
      expect(Object.keys(transport).sort()).toEqual([
        "createBucket",
        "createObject",
        "getBucket",
        "listKeys",
        "readObject",
      ]);
    });
    const count = fetchRequest.mock.calls.length;
    await expect(retained!.getBucket(SNAPSHOT_BUCKET)).rejects.toThrow(
      "SNAPSHOT_PUBLISHER_CREDENTIAL_RETIRED",
    );
    expect(fetchRequest.mock.calls).toHaveLength(count);
    expect(fetchRequest.mock.calls.at(-1)![1].signal!.aborted).toBe(true);
    const upload = fetchRequest.mock.calls.at(-1)![1];
    expect(upload.method).toBe("POST");
    expect(new Headers(upload.headers).get("x-upsert")).toBe("false");
  });
  it("rejects unlisted buckets/keys/objects/upsert and altered bytes before any Storage call", async () => {
    const { run, fetchRequest } = mock();
    await run(async (t) => {
      await expect(t.getBucket("old-bucket")).rejects.toThrow("SCOPE_REJECTED");
      await expect(t.readObject(SNAPSHOT_BUCKET, "../old")).rejects.toThrow(
        "SCOPE_REJECTED",
      );
      await expect(
        t.createBucket({ ...bucket, public: false }),
      ).rejects.toThrow("SCOPE_REJECTED");
      await expect(
        t.createObject(SNAPSHOT_BUCKET, key, bytes, {
          contentType: "application/json",
          upsert: true,
        }),
      ).rejects.toThrow("SOURCE_REJECTED");
      await expect(
        t.createObject(SNAPSHOT_BUCKET, key, Buffer.from("altered"), {
          contentType: "application/json",
          upsert: false,
        }),
      ).rejects.toThrow("SOURCE_REJECTED");
    });
    expect(fetchRequest.mock.calls).toHaveLength(1);
  });
  it("checks fixed manifest before acquiring a key", async () => {
    const { fetchRequest } = mock();
    await expect(
      withEphemeralSnapshotTransport(
        {
          manifest: manifest.slice(1),
          managementToken: management,
          fetchRequest,
        },
        async () => {},
      ),
    ).rejects.toThrow("MANIFEST_INVALID");
    expect(fetchRequest).not.toHaveBeenCalled();
  });
  it("drops key capability and sanitizes unexpected callback or network details", async () => {
    const { run, fetchRequest } = mock();
    let retained: SnapshotTransport | undefined;
    await expect(
      run(async (t) => {
        retained = t;
        throw new Error(credential);
      }),
    ).rejects.toThrow("SNAPSHOT_PUBLISHER_OPERATION_FAILED");
    await expect(retained!.getBucket(SNAPSHOT_BUCKET)).rejects.toThrow(
      "CREDENTIAL_RETIRED",
    );
    expect(fetchRequest.mock.calls).toHaveLength(1);
    const network = vi.fn(async () => {
      throw new Error(credential);
    });
    await expect(
      withEphemeralSnapshotTransport(
        { manifest, managementToken: management, fetchRequest: network },
        async () => {},
      ),
    ).rejects.toThrow("SNAPSHOT_PUBLISHER_OPERATION_FAILED");
  });
  it("stops on uncertain write with one request and no retry/delete/update", async () => {
    const { run, responses, fetchRequest } = mock();
    responses.push(json({ message: credential }, 503));
    await expect(
      run(async (t) =>
        t.createObject(SNAPSHOT_BUCKET, key, bytes, {
          contentType: "application/json",
          upsert: false,
        }),
      ),
    ).rejects.toThrow("SNAPSHOT_OBJECT_OUTCOME_UNKNOWN_NO_RETRY");
    expect(fetchRequest.mock.calls).toHaveLength(2);
  });
  it("rejects changed MIME/bytes and unexpected prefix; recognizes only explicit missing objects", async () => {
    for (const response of [
      new Response(bytes, { headers: { "content-type": "text/plain" } }),
      new Response(Buffer.concat([bytes, Buffer.from("x")]), {
        headers: { "content-type": "application/json" },
      }),
      new Response(null, { status: 302 }),
    ]) {
      const { run, responses } = mock();
      responses.push(response);
      await expect(
        run(async (t) => t.readObject(SNAPSHOT_BUCKET, key)),
      ).rejects.toThrow();
    }
    const missing = mock();
    missing.responses.push(
      json({ statusCode: "404", error: "not_found" }, 400),
    );
    expect(
      await missing.run(async (t) => t.readObject(SNAPSHOT_BUCKET, key)),
    ).toBeNull();
    const extra = mock();
    extra.responses.push(json([{ name: "unlisted", id: null }]));
    await expect(
      extra.run(async (t) => t.listKeys(SNAPSHOT_BUCKET)),
    ).rejects.toThrow("UNEXPECTED_PUBLIC_OBJECT");
  });
  it("rejects ambiguous or non-service-role credentials without returning response values", async () => {
    const fetchRequest = vi.fn(async () =>
      json([
        { name: "service_role", type: "legacy", api_key: credential },
        { name: "service_role", type: "legacy", api_key: credential },
      ]),
    );
    await expect(
      withEphemeralSnapshotTransport(
        { manifest, managementToken: management, fetchRequest },
        async () => {},
      ),
    ).rejects.toThrow("SNAPSHOT_PUBLISHER_KEY_MULTIPLE");
    expect(fetchRequest).toHaveBeenCalledTimes(1);
  });
  it.each([
    [[], "NOT_FOUND"],
    [
      [{ type: "publishable", name: "service_role", api_key: credential }],
      "NOT_FOUND",
    ],
    [
      [
        {
          type: "secret",
          name: "custom",
          secret_jwt_template: null,
          api_key: credential,
        },
      ],
      "METADATA_INVALID",
    ],
    [
      [
        {
          type: "secret",
          name: "custom",
          secret_jwt_template: {},
          api_key: credential,
        },
      ],
      "METADATA_INVALID",
    ],
    [[{ type: "legacy", name: "service_role", api_key: null }], "TYPE_INVALID"],
    [[{ type: "legacy", name: "service_role" }], "TYPE_INVALID"],
    [[{ type: "legacy", name: "service_role", api_key: 17 }], "TYPE_INVALID"],
    [[{ type: "legacy", name: "service_role", api_key: "" }], "INVALID"],
    [
      [
        {
          type: "secret",
          secret_jwt_template: { role: "service_role" },
          api_key: credential,
        },
      ],
      "INVALID",
    ],
    [
      [
        { type: "legacy", name: "service_role", api_key: credential },
        {
          type: "secret",
          secret_jwt_template: { role: "service_role" },
          api_key: "synthetic-only",
        },
      ],
      "INVALID",
    ],
  ])(
    "distinguishes zero/multiple/type/format without Storage or response disclosure (%#)",
    async (entries, suffix) => {
      const fetchRequest = vi.fn(async () => json(entries));
      const operation = vi.fn();
      await expect(
        withEphemeralSnapshotTransport(
          { manifest, managementToken: management, fetchRequest },
          operation,
        ),
      ).rejects.toThrow(`SNAPSHOT_PUBLISHER_KEY_${suffix}`);
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(operation).not.toHaveBeenCalled();
    },
  );
  it("retains secret lease protocol and legacy JWT ref/role checks", async () => {
    const synthetic = "sb_secret_" + "synthetic_mock_only_not_real";
    const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("/api-keys?reveal=true"))
        return json([
          {
            type: "secret",
            secret_jwt_template: { role: "service_role" },
            api_key: synthetic,
          },
        ]);
      expect(new Headers(init.headers).get("apikey")).toBe(synthetic);
      expect(new Headers(init.headers).get("authorization")).toBeNull();
      return json(bucket);
    });
    await withEphemeralSnapshotTransport(
      { manifest, managementToken: management, fetchRequest },
      (t: SnapshotTransport) => t.getBucket(SNAPSHOT_BUCKET),
    );
    expect(fetchRequest).toHaveBeenCalledTimes(2);
    for (const claims of [
      { ref: "wrong-project", role: "service_role" },
      { ref: SNAPSHOT_PROJECT_REF, role: "anon" },
    ]) {
      const jwt = [
        "e30",
        Buffer.from(JSON.stringify(claims)).toString("base64url"),
        "synthetic",
      ].join(".");
      const rejected = vi.fn(async () =>
        json([{ name: "service_role", type: "legacy", api_key: jwt }]),
      );
      await expect(
        withEphemeralSnapshotTransport(
          { manifest, managementToken: management, fetchRequest: rejected },
          vi.fn(),
        ),
      ).rejects.toThrow("SNAPSHOT_PUBLISHER_KEY_INVALID");
      expect(rejected).toHaveBeenCalledTimes(1);
    }
  });
  it.each([
    [[modernEntry(), legacyEntry()], modernCredential],
    [[legacyEntry(), modernEntry()], modernCredential],
    [
      [modernEntry(), legacyEntry(), legacyEntry("invalid-unused-legacy")],
      modernCredential,
    ],
    [
      [
        modernEntry(),
        legacyEntry(null, { secret_jwt_template: { role: "anon" } }),
      ],
      modernCredential,
    ],
    [[modernEntry()], modernCredential],
    [[legacyEntry()], credential],
    [[legacyEntry(credential, { secret_jwt_template: null })], credential],
    [[legacyEntry(credential, { secret_jwt_template: {} })], credential],
    [
      [
        legacyEntry(credential, {
          secret_jwt_template: { role: "service_role" },
        }),
      ],
      credential,
    ],
    [
      [
        legacyEntry(),
        { type: "publishable", name: "service_role", api_key: "unused-public" },
      ],
      credential,
    ],
    [
      [
        modernEntry("unused-secret", { secret_jwt_template: { role: "anon" } }),
        legacyEntry(),
      ],
      credential,
    ],
  ])(
    "uses the unique modern tier or strictly typed legacy fallback (%#)",
    async (entries, selected) => {
      const operation = vi.fn(async (t: SnapshotTransport) =>
        t.getBucket(SNAPSHOT_BUCKET),
      );
      const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/api-keys?reveal=true")) return json(entries);
        expect(url).toBe(
          `https://${SNAPSHOT_PROJECT_REF}.supabase.co/storage/v1/bucket/${SNAPSHOT_BUCKET}`,
        );
        const headers = new Headers(init.headers);
        expect(headers.get("apikey")).toBe(selected);
        expect(headers.get("authorization")).toBe(
          selected === modernCredential ? null : `Bearer ${credential}`,
        );
        return json(bucket);
      });
      await expect(
        withEphemeralSnapshotTransport(
          { manifest, managementToken: management, fetchRequest },
          operation,
        ),
      ).resolves.toEqual(bucket);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(fetchRequest).toHaveBeenCalledTimes(2);
      expect(
        fetchRequest.mock.calls.filter(([url]) =>
          url.includes("api.supabase.com"),
        ),
      ).toHaveLength(1);
    },
  );
  it.each([
    [[modernEntry(), modernEntry()], "MULTIPLE"],
    [[modernEntry(), modernEntry(), legacyEntry()], "MULTIPLE"],
    [[modernEntry(), modernEntry(null), legacyEntry()], "MULTIPLE"],
    [[legacyEntry(), legacyEntry()], "MULTIPLE"],
    [[legacyEntry(), legacyEntry(null)], "MULTIPLE"],
    [[modernEntry(null), legacyEntry()], "TYPE_INVALID"],
    [[modernEntry(17), legacyEntry()], "TYPE_INVALID"],
    [[modernEntry(""), legacyEntry()], "INVALID"],
    [[modernEntry("synthetic-invalid-format"), legacyEntry()], "INVALID"],
    [[modernEntry(credential), legacyEntry()], "INVALID"],
    [
      [modernEntry(modernCredential, { api_key: undefined }), legacyEntry()],
      "TYPE_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, { secret_jwt_template: null }),
        legacyEntry(),
      ],
      "METADATA_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, { secret_jwt_template: undefined }),
        legacyEntry(),
      ],
      "METADATA_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, { secret_jwt_template: [] }),
        legacyEntry(),
      ],
      "METADATA_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, { secret_jwt_template: {} }),
        legacyEntry(),
      ],
      "METADATA_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, { secret_jwt_template: { role: 7 } }),
        legacyEntry(),
      ],
      "METADATA_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, {
          name: "service_role",
          secret_jwt_template: { role: "anon" },
        }),
        legacyEntry(),
      ],
      "METADATA_INVALID",
    ],
    [
      [
        modernEntry(modernCredential, {
          secret_jwt_template: { role: "anon" },
        }),
      ],
      "NOT_FOUND",
    ],
    [[legacyEntry(credential, { type: null })], "NOT_FOUND"],
    [[legacyEntry(credential, { type: undefined })], "NOT_FOUND"],
    [[legacyEntry(credential, { type: "unknown" })], "NOT_FOUND"],
    [[legacyEntry(credential, { name: "unknown" })], "NOT_FOUND"],
    [
      [legacyEntry(credential, { secret_jwt_template: { role: "anon" } })],
      "METADATA_INVALID",
    ],
    [
      [legacyEntry(credential, { secret_jwt_template: [] })],
      "METADATA_INVALID",
    ],
  ])(
    "rejects tier ambiguity, selected-value faults and metadata conflicts without fallback or disclosure (%#)",
    async (entries, code) => {
      const operation = vi.fn();
      const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
        expect(url).toBe(
          `https://api.supabase.com/v1/projects/${SNAPSHOT_PROJECT_REF}/api-keys?reveal=true`,
        );
        expect(init.method).toBe("GET");
        expect(init.redirect).toBe("error");
        expect(init.credentials).toBe("omit");
        return json(entries);
      });
      await expect(
        withEphemeralSnapshotTransport(
          { manifest, managementToken: management, fetchRequest },
          operation,
        ),
      ).rejects.toThrow(`SNAPSHOT_PUBLISHER_KEY_${code}`);
      expect(operation).not.toHaveBeenCalled();
      expect(fetchRequest).toHaveBeenCalledTimes(1);
    },
  );
  it("sanitizes modern callback faults and retires its retained capability with no extra HTTP", async () => {
    const fetchRequest = vi.fn(async () =>
      json([modernEntry(), legacyEntry()]),
    );
    let retained: SnapshotTransport | undefined;
    await expect(
      withEphemeralSnapshotTransport(
        { manifest, managementToken: management, fetchRequest },
        async (t: SnapshotTransport) => {
          retained = t;
          throw new Error(modernCredential);
        },
      ),
    ).rejects.toThrow("SNAPSHOT_PUBLISHER_OPERATION_FAILED");
    await expect(retained!.getBucket(SNAPSHOT_BUCKET)).rejects.toThrow(
      "SNAPSHOT_PUBLISHER_CREDENTIAL_RETIRED",
    );
    expect(fetchRequest).toHaveBeenCalledTimes(1);
  });
  it.each([null, { rows: [] }, [null], [[]], ["synthetic-response-value"]])(
    "rejects malformed response entries before admission without disclosure (%#)",
    async (entries) => {
      const fetchRequest = vi.fn(async () => json(entries));
      const operation = vi.fn();
      await expect(
        withEphemeralSnapshotTransport(
          { manifest, managementToken: management, fetchRequest },
          operation,
        ),
      ).rejects.toThrow("SNAPSHOT_PUBLISHER_KEY_RESPONSE_INVALID");
      expect(operation).not.toHaveBeenCalled();
      expect(fetchRequest).toHaveBeenCalledTimes(1);
    },
  );
});
describe("bounded Storage permission proof", () => {
  it("permits missing effective grants or actual RLS default deny, never calls old catalog", () => {
    expect(verifyStorageWriteBoundary(evidence()).status).toBe(
      "SNAPSHOT_DIRECT_STORAGE_WRITE_DENIED",
    );
    expect(verifyStorageWriteBoundary(evidence(true)).status).toBe(
      "SNAPSHOT_DIRECT_STORAGE_WRITE_DENIED",
    );
    expect(SNAPSHOT_STORAGE_PERMISSION_SQL).not.toMatch(
      /rolpassword|world_v2\.|pg_proc|alter |create |grant /iu,
    );
  });
  it("requires exact restrictive veto when a permissive policy might allow writes", () => {
    const proof = evidence(true);
    proof.policies = ["buckets", "objects"].flatMap((table) => [
      {
        table,
        name: "synthetic_existing_permissive",
        command: "*",
        permissive: true,
        qual: "true",
        check: "true",
        applies_to: ["anon", "authenticated"],
      },
      {
        table,
        name: "synthetic_new_scope_only",
        command: "*",
        permissive: false,
        qual: `(${table === "objects" ? "bucket_id" : "id"} IS DISTINCT FROM '${SNAPSHOT_BUCKET}'::text)`,
        check: null,
        applies_to: ["anon", "authenticated"],
      },
    ]);
    expect(verifyStorageWriteBoundary(proof).status).toBe(
      "SNAPSHOT_DIRECT_STORAGE_WRITE_DENIED",
    );
    for (const changed of [
      proof.policies.filter((p) => p.permissive),
      proof.policies.map((p) => ({
        ...p,
        qual: p.permissive ? p.qual : p.qual + " OR true",
      })),
      proof.policies.map((p) => ({
        ...p,
        qual:
          p.qual?.replace(SNAPSHOT_BUCKET, SNAPSHOT_BUCKET.toUpperCase()) ??
          null,
      })),
    ])
      expect(() =>
        verifyStorageWriteBoundary({ ...proof, policies: changed }),
      ).toThrow();
    expect(() =>
      verifyStorageWriteBoundary({
        ...proof,
        relations: proof.relations.map((r) => ({ ...r, rls: false })),
      }),
    ).toThrow();
  });
  it("rejects incomplete coverage, owner/BYPASSRLS and column-only privilege gaps", () => {
    for (const changed of [
      { ...evidence(), roles: [] },
      {
        ...evidence(),
        roles: evidence().roles.map((r) => ({ ...r, bypass_rls: true })),
      },
    ])
      expect(() => verifyStorageWriteBoundary(changed)).toThrow();
    const proof = evidence();
    proof.roles[0].column_insert = true;
    proof.policies = [
      {
        table: proof.roles[0].table,
        name: "synthetic_insert",
        command: "a",
        permissive: true,
        qual: null,
        check: "true",
        applies_to: [proof.roles[0].role],
      },
    ];
    expect(() => verifyStorageWriteBoundary(proof)).toThrow(
      "WRITE_BOUNDARY_BLOCKED",
    );
  });
});
