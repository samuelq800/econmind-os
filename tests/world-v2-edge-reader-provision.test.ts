import { describe, expect, it } from "vitest";

import {
  EVIDENCE_SQL,
  EXPECTED_EFFECTIVE_ACCESS,
  FUNCTION_SLUG,
  LOGIN_ROLE,
  PROJECT_REF,
  READER_ROLE,
  credentialFiles,
  ensureNewFunctionSlug,
  ensureNewSecretNames,
  poolerHost,
  responseEvidence,
  roleActivationSql,
  verifyEvidence,
  verifyFunctionSlug,
  verifySecretNames,
  // @ts-expect-error Node ESM helper intentionally has no TypeScript declarations.
} from "../scripts/world-v2-edge-reader-provision.mjs";
import {
  MIGRATION_ID,
  MIGRATION_SHA256,
  MIGRATION_SOURCE_COMMIT,
  // @ts-expect-error The frozen 0021 renderer is a Node ESM module.
} from "../scripts/render-world-v2-api-full-reader-release.mjs";

const password = "ab".repeat(48);
const host = "aws-0-ap-northeast-1.pooler.supabase.com";
const names = [
  "WORLD_DATABASE_URL",
  "WORLD_API_DB_LOGIN_ROLE",
  "WORLD_API_DB_READER_ROLE",
  "WORLD_DATABASE_FINGERPRINT",
  "WORLD_DATABASE_NAMESPACE",
  "WORLD_DATABASE_MUTATION_MODE",
  "WORLD_API_OFFICIAL_PUBLIC_ORIGINS",
];
const role = (canLogin: boolean) => ({
  can_login: canLogin,
  can_bypass_rls: false,
  is_superuser: false,
  inherits_privileges: false,
  can_create_db: false,
  can_create_role: false,
  can_replicate: false,
});
const evidence = (canLogin: boolean) => ({
  migration_count: 21,
  migration: {
    migration_id: MIGRATION_ID,
    artifact_sha256: MIGRATION_SHA256,
    source_repo_commit: MIGRATION_SOURCE_COMMIT,
    release_order: 21,
  },
  login_role: role(canLogin),
  reader_role: role(false),
  effective_access: EXPECTED_EFFECTIVE_ACCESS,
  set_role_closure: {
    [LOGIN_ROLE]: [LOGIN_ROLE, READER_ROLE],
    [READER_ROLE]: [READER_ROLE],
  },
  catalog: {
    coverage: { roles: 2, schemas: 0, relations: 0, routines: 0 },
    schemas: [],
    relations: [],
    routines: [],
  },
  login_memberships: [
    {
      role: READER_ROLE,
      admin_option: false,
      inherit_option: false,
      set_option: true,
    },
  ],
});

describe("World V2 Edge reader credential provision guard", () => {
  it("pins the 0021 release, exact roles, and existing membership", () => {
    expect(verifyEvidence(evidence(false), false)).toBe(true);
    expect(verifyEvidence(evidence(true), true)).toBe(true);
    expect(() => verifyEvidence(evidence(true), false)).toThrow();
    expect(() =>
      verifyEvidence({ ...evidence(false), login_memberships: [] }, false),
    ).toThrow();
    expect(() =>
      verifyEvidence({ ...evidence(false), migration_count: 22 }, false),
    ).toThrow();
    expect(responseEvidence([{ evidence: evidence(false) }])).toEqual(
      evidence(false),
    );
    expect(EVIDENCE_SQL).not.toContain("rolpassword");
  });

  it("only accepts the project shared transaction pooler", () => {
    const config = [
      {
        pool_mode: "transaction",
        connection_string: `postgresql://postgres.${PROJECT_REF}:placeholder@${host}:6543/postgres`,
      },
    ];
    expect(poolerHost(config)).toBe(host);
    expect(() =>
      poolerHost([
        {
          ...config[0],
          connection_string: `postgresql://postgres.${PROJECT_REF}:placeholder@${host}:5432/postgres`,
        },
      ]),
    ).toThrow();
    expect(() =>
      poolerHost([
        {
          ...config[0],
          connection_string: `postgresql://postgres.other:placeholder@${host}:6543/postgres`,
        },
      ]),
    ).toThrow();
    expect(() => poolerHost([...config, ...config])).toThrow();
  });

  it("rejects PUBLIC object access and extra SET targets", () => {
    for (const kind of [
      "table",
      "column",
      "routine",
      "sequence",
      "schema_create",
    ]) {
      expect(() =>
        verifyEvidence(
          {
            ...evidence(false),
            effective_access: [
              ...EXPECTED_EFFECTIVE_ACCESS,
              {
                role: LOGIN_ROLE,
                kind,
                schema: "public",
                object: "legacy_mutation",
                column: null,
                privilege: kind === "routine" ? "EXECUTE" : "SELECT",
                security_definer: kind === "routine",
              },
            ],
          },
          false,
        ),
      ).toThrow();
    }
    expect(() =>
      verifyEvidence(
        {
          ...evidence(false),
          set_role_closure: {
            [LOGIN_ROLE]: [LOGIN_ROLE, READER_ROLE],
            [READER_ROLE]: [READER_ROLE, "legacy_writer"],
          },
        },
        false,
      ),
    ).toThrow();
    expect(roleActivationSql(password)).toContain("has_function_privilege");
    expect(roleActivationSql(password)).toContain(
      "pg_has_role('world_v2_api_reader'",
    );
  });

  it("builds only a server-only TLS credential and one guarded ALTER ROLE", () => {
    const files = credentialFiles(host, password);
    const url = new URL(
      files.env.match(/^WORLD_DATABASE_URL=(.*)$/mu)?.[1] ?? "",
    );
    expect(url.username).toBe(`${LOGIN_ROLE}.${PROJECT_REF}`);
    expect(url.password).toBe(password);
    expect(url.hostname).toBe(host);
    expect(url.port).toBe("6543");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(files.env).toContain(`WORLD_API_DB_READER_ROLE=${READER_ROLE}`);
    expect(files.env).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    const sql = JSON.parse(files.request).query;
    expect(sql).toBe(roleActivationSql(password));
    expect(sql.match(/alter role/giu)).toHaveLength(1);
    expect(sql).not.toMatch(/grant\s/iu);
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(() => credentialFiles("example.com", password)).toThrow();
    expect(() => roleActivationSql("weak")).toThrow();
  });

  it("blocks collisions with existing project secrets or functions", () => {
    expect(ensureNewSecretNames([{ name: "OTHER_SECRET" }])).toBe(true);
    expect(() => ensureNewSecretNames([{ name: names[0] }])).toThrow();
    expect(verifySecretNames(names.map((name) => ({ name })))).toBe(true);
    expect(() => verifySecretNames([{ name: names[0] }])).toThrow();
    expect(ensureNewFunctionSlug([{ slug: "existing-worker" }])).toBe(true);
    expect(() => ensureNewFunctionSlug([{ slug: FUNCTION_SLUG }])).toThrow();
    expect(
      verifyFunctionSlug([
        { slug: FUNCTION_SLUG, status: "ACTIVE", verify_jwt: false },
      ]),
    ).toBe(true);
    expect(() =>
      verifyFunctionSlug([
        { slug: FUNCTION_SLUG, status: "ACTIVE", verify_jwt: true },
      ]),
    ).toThrow();
  });
});
