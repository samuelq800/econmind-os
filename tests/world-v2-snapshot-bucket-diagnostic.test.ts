import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  bucketDiagnosticFingerprint,
  verifyBucketDiagnosticLock,
  collectBucketDiagnostic,
  BUCKET_DIAGNOSTIC_ID,
  BUCKET_DIAGNOSTIC_CONFIRMATION,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-snapshot-bucket-diagnostic.mjs";
import {
  classifySnapshotBucketDiagnostic,
  SNAPSHOT_PROJECT_REF,
  SNAPSHOT_BUCKET,
  // @ts-expect-error Node ESM helper has no declarations.
} from "../scripts/world-v2-source-snapshot-transport.mjs";
const secret = "sb_secret_" + "synthetic_diagnostic_only_not_real";
const management = "synthetic-management-only";
const managementUrl = `https://api.supabase.com/v1/projects/${SNAPSHOT_PROJECT_REF}/api-keys?reveal=true`;
const bucketUrl = `https://${SNAPSHOT_PROJECT_REF}.supabase.co/storage/v1/bucket/${SNAPSHOT_BUCKET}`;
const modern = {
  type: "secret",
  name: "synthetic-custom-name",
  secret_jwt_template: { role: "service_role" },
  api_key: secret,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const canonical = {
  statusCode: "404",
  code: "NoSuchBucket",
  error: "Bucket not found",
  message: "Bucket not found",
};
async function context() {
  return {
    authorizationId: BUCKET_DIAGNOSTIC_ID,
    confirmation: BUCKET_DIAGNOSTIC_CONFIRMATION,
    lock: `BUCKET_DIAGNOSTIC_GO:${await bucketDiagnosticFingerprint()}`,
    projectRef: SNAPSHOT_PROJECT_REF,
    repository: "samuelq800/econmind-os",
    ref: "refs/heads/main",
    runAttempt: "1",
    sha: "acb02114a847c2debef9dcfff492b7c334c32a91",
    managementToken: management,
  };
}
function mock(response: () => Response, entries: unknown = [modern]) {
  const signals: AbortSignal[] = [];
  const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("error");
    expect(init.credentials).toBe("omit");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = new Headers(init.headers);
    if (url === managementUrl) {
      expect(headers.get("authorization")).toBe(`Bearer ${management}`);
      expect(headers.get("apikey")).toBeNull();
      return json(entries);
    }
    expect(url).toBe(bucketUrl);
    expect(headers.get("apikey")).toBe(secret);
    expect(headers.get("authorization")).toBeNull();
    signals.push(init.signal as AbortSignal);
    return response();
  });
  return { fetchRequest, signals };
}
describe("diagnostic classification only, never publisher missing admission", () => {
  it.each([
    [400, canonical, "KNOWN_NO_SUCH_BUCKET_SHAPE_NOT_ABSENCE_PROOF"],
    [404, canonical, "KNOWN_NO_SUCH_BUCKET_SHAPE_NOT_ABSENCE_PROOF"],
    [
      400,
      { ...canonical, error: "NoSuchBucket", statusCode: 404 },
      "KNOWN_NO_SUCH_BUCKET_SHAPE_NOT_ABSENCE_PROOF",
    ],
    [
      400,
      {
        statusCode: "404",
        error: "Bucket not found",
        message: "Bucket not found",
      },
      "LEGACY_BUCKET_NOT_FOUND_SHAPE_NOT_ABSENCE_PROOF",
    ],
    [
      400,
      { statusCode: 404, error: "not_found" },
      "LEGACY_NOT_FOUND_SHAPE_NOT_ABSENCE_PROOF",
    ],
    [
      401,
      { code: "InvalidJWT", message: "synthetic-sensitive-details" },
      "KNOWN_InvalidJWT_SHAPE",
    ],
    [
      400,
      { statusCode: "403", code: "AccessDenied", error: "AccessDenied" },
      "KNOWN_AccessDenied_SHAPE",
    ],
    [404, { code: "TenantNotFound" }, "KNOWN_TenantNotFound_SHAPE"],
    [404, { code: "NoSuchKey" }, "KNOWN_NoSuchKey_SHAPE"],
    [500, { code: "InternalError" }, "KNOWN_InternalError_SHAPE"],
    [
      200,
      {
        id: "synthetic-sensitive-details",
        name: "synthetic-sensitive-details",
      },
      "HTTP_200_JSON_OBJECT_OBSERVED",
    ],
  ])(
    "allowlists exact error shapes but not resource existence (%#)",
    (http, body, category) => {
      const observation = classifySnapshotBucketDiagnostic(http, body);
      expect(observation.http_status).toBe(http);
      expect(observation.error_category).toBe(category);
      expect(JSON.stringify(observation)).not.toContain(
        "synthetic-sensitive-details",
      );
      expect(observation).not.toHaveProperty("bucket_exists");
      expect(observation).not.toHaveProperty("response_sha256");
    },
  );
  it.each([
    [401, canonical],
    [403, canonical],
    [500, canonical],
    [400, { ...canonical, statusCode: "0404" }],
    [400, { ...canonical, statusCode: "404 " }],
    [400, { ...canonical, statusCode: null }],
    [400, { ...canonical, code: "private-code" }],
    [400, { ...canonical, error: "AccessDenied" }],
    [400, { ...canonical, message: "Bucket not found private-text" }],
    [400, { ...canonical, error: "bucket not found" }],
    [400, { ...canonical, code: { toString: "private-code" } }],
    [404, { code: "__proto__" }],
    [404, { code: "constructor" }],
    [404, { statusCode: "401", code: "InvalidJWT" }],
    [404, null],
    [404, "private-text"],
    [200, []],
  ])(
    "does not guess missing from HTTP404, keywords, contradictions or malformed fields (%#)",
    (http, body) => {
      const observation = classifySnapshotBucketDiagnostic(http, body);
      expect(observation.error_category).toBe("UNKNOWN_RESPONSE_SHAPE_STOP");
      expect(JSON.stringify(observation)).not.toMatch(
        /private-code|private-text/u,
      );
    },
  );
  it("reports only fixed field presence/shape and unknown counts, including nested private data", () => {
    const privateValue = "synthetic-private-response-value";
    const observation = classifySnapshotBucketDiagnostic(400, {
      ...canonical,
      message: { privateValue },
      [privateValue]: privateValue,
      custom: { nested: privateValue },
      arr: [privateValue],
      zero: null,
    });
    expect(observation.known_fields.message).toEqual({
      present: true,
      shape: "object",
    });
    expect(observation.unknown_field_count).toBe(4);
    expect(observation.unknown_field_shape_counts).toEqual({
      null: 1,
      string: 1,
      object: 1,
      array: 1,
      number: 0,
      boolean: 0,
      other: 0,
    });
    expect(JSON.stringify(observation)).not.toContain(privateValue);
    expect(JSON.stringify(observation)).not.toContain("nested");
  });
});
describe("separately guarded bucket diagnostic, mock HTTP only", () => {
  it.each([200, 400, 404])(
    "executes just one lease GET and one fixed bucket GET then retires (%s)",
    async (status) => {
      const { fetchRequest, signals } = mock(() =>
        json(
          status === 200
            ? { id: "private-id", name: "private-name" }
            : canonical,
          status,
        ),
      );
      const receipt = await collectBucketDiagnostic(await context(), {
        fetchRequest,
      });
      expect(receipt.status).toBe("BUCKET_RESPONSE_OBSERVED_NOT_RELEASE_GO");
      expect(receipt.request_counts).toEqual({
        management_key_get: 1,
        storage_bucket_get: 1,
        write: 0,
      });
      expect(fetchRequest).toHaveBeenCalledTimes(2);
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(true);
      expect(JSON.stringify(receipt)).not.toMatch(
        /private-id|private-name|synthetic_diagnostic_only|synthetic-management/u,
      );
      expect(receipt.publication).toBe("NOT_RUN");
      expect(receipt.historical_failure_root_cause).toBe("NOT_EVIDENCED");
      expect(receipt).not.toHaveProperty("transport");
    },
  );
  it.each([
    ["lock", ""],
    ["lock", "RELEASE_GO:wrong"],
    ["lock", "METADATA_GO:wrong"],
    ["lock", "BUCKET_DIAGNOSTIC_GO:wrong"],
    ["confirmation", "RELEASE_GO_WORLD_V2_SOURCE_SNAPSHOT_ONCE"],
    ["authorizationId", "wrong"],
    ["projectRef", "other"],
    ["repository", "other"],
    ["ref", "refs/heads/candidate"],
    ["runAttempt", "2"],
    ["sha", "invalid"],
    ["managementToken", ""],
  ])("rejects guard drift before any request (%#)", async (field, value) => {
    const fetchRequest = vi.fn();
    await expect(
      collectBucketDiagnostic(
        { ...(await context()), [field]: value },
        { fetchRequest },
      ),
    ).rejects.toThrow("SNAPSHOT_BUCKET_DIAGNOSTIC_HOLD");
    expect(fetchRequest).not.toHaveBeenCalled();
  });
  it("rejects the old approved publisher fingerprint as diagnostic authorization", async () => {
    const input = await context();
    input.lock =
      "BUCKET_DIAGNOSTIC_GO:a64313ecf2471697c5e5ab9c7576208cdacd9154cabcae0c490f1b5c0e8632a0";
    await expect(verifyBucketDiagnosticLock(input)).rejects.toThrow("HOLD");
  });
  it.each([
    [[], "SNAPSHOT_PUBLISHER_KEY_NOT_FOUND"],
    [[modern, modern], "SNAPSHOT_PUBLISHER_KEY_MULTIPLE"],
    [[{ ...modern, api_key: null }], "SNAPSHOT_PUBLISHER_KEY_TYPE_INVALID"],
    [
      [{ ...modern, api_key: "synthetic-invalid" }],
      "SNAPSHOT_PUBLISHER_KEY_INVALID",
    ],
    [
      [{ ...modern, secret_jwt_template: null }],
      "SNAPSHOT_PUBLISHER_KEY_METADATA_INVALID",
    ],
  ])(
    "preserves selector refusal with only the existing key GET (%#)",
    async (entries, code) => {
      const { fetchRequest } = mock(() => json(canonical, 400), entries);
      const receipt = await collectBucketDiagnostic(await context(), {
        fetchRequest,
      });
      expect(receipt.status).toBe("BUCKET_DIAGNOSTIC_FAILED_STOP_NO_RETRY");
      expect(receipt.code).toBe(code);
      expect(receipt.request_counts).toEqual({
        management_key_get: 1,
        storage_bucket_get: 0,
        write: 0,
      });
      expect(fetchRequest).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [
      () => new Response("private-html", { status: 403 }),
      "BODY_INVALID_JSON_STOP",
    ],
    [() => json("x".repeat(16_385), 400), "BODY_LIMIT_STOP"],
    [() => new Response(null, { status: 204 }), "BODY_UNREADABLE_STOP"],
    [() => json({ code: "private-error" }, 404), "UNKNOWN_RESPONSE_SHAPE_STOP"],
  ])(
    "bounds body failures and preserves only numeric status plus finite category (%#)",
    async (response, category) => {
      const { fetchRequest, signals } = mock(response);
      const receipt = await collectBucketDiagnostic(await context(), {
        fetchRequest,
      });
      expect(receipt.status).toBe("BUCKET_DIAGNOSTIC_UNKNOWN_STOP_NO_RETRY");
      expect(receipt.observation.error_category).toBe(category);
      expect(typeof receipt.observation.http_status).toBe("number");
      expect(JSON.stringify(receipt)).not.toMatch(
        /private-html|private-error/u,
      );
      expect(fetchRequest).toHaveBeenCalledTimes(2);
      expect(signals[0].aborted).toBe(true);
    },
  );
  it("rejects redirected responses without following or persisting headers", async () => {
    const response = json(canonical, 400);
    Object.defineProperty(response, "redirected", { value: true });
    const { fetchRequest } = mock(() => response);
    const receipt = await collectBucketDiagnostic(await context(), {
      fetchRequest,
    });
    expect(receipt.code).toBe("SNAPSHOT_BUCKET_DIAGNOSTIC_REDIRECT_REJECTED");
    expect(fetchRequest).toHaveBeenCalledTimes(2);
  });
  it("sanitizes network errors including finite-looking injected details; no retry", async () => {
    const fetchRequest = vi.fn(async (url: string) => {
      if (url === managementUrl) return json([modern]);
      throw new Error("SNAPSHOT_PRIVATE_VALUE");
    });
    const receipt = await collectBucketDiagnostic(await context(), {
      fetchRequest,
    });
    expect(receipt.code).toBe("SNAPSHOT_BUCKET_DIAGNOSTIC_REQUEST_FAILED");
    expect(JSON.stringify(receipt)).not.toContain("PRIVATE_VALUE");
    expect(fetchRequest).toHaveBeenCalledTimes(2);
  });
  it("keeps legacy auth contract and does not retain the credential in a receipt", async () => {
    const jwt = [
      "e30",
      Buffer.from(
        JSON.stringify({ ref: SNAPSHOT_PROJECT_REF, role: "service_role" }),
      ).toString("base64url"),
      "synthetic",
    ].join(".");
    const fetchRequest = vi.fn(async (url: string, init: RequestInit) => {
      if (url === managementUrl)
        return json([{ type: "legacy", name: "service_role", api_key: jwt }]);
      expect(url).toBe(bucketUrl);
      expect(new Headers(init.headers).get("authorization")).toBe(
        `Bearer ${jwt}`,
      );
      return json(canonical, 400);
    });
    const receipt = await collectBucketDiagnostic(await context(), {
      fetchRequest,
    });
    expect(receipt.status).toBe("BUCKET_RESPONSE_OBSERVED_NOT_RELEASE_GO");
    expect(JSON.stringify(receipt)).not.toContain(jwt);
    expect(fetchRequest).toHaveBeenCalledTimes(2);
  });
  it("keeps workflow diagnostic-only with no publisher, raw output or deployment command", () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/diagnose-world-v2-snapshot-bucket.yml",
        import.meta.url,
      ),
      "utf8",
    );
    expect(workflow).toContain("WORLD_V2_SNAPSHOT_BUCKET_DIAGNOSTIC_LOCK");
    expect(workflow).not.toMatch(
      /curl |functions deploy|permissions-render|phase:|WORLD_V2_SNAPSHOT_RELEASE_LOCK/u,
    );
  });
});
