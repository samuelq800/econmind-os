import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import manifest from "@/content/legal/source-manifest.json";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  POLICY_ACKNOWLEDGEMENT_RELEASE,
  PolicyConfirmationCoordinator,
  allPoliciesChecked,
  emptyPolicyChecks,
  type PolicyStatus,
} from "@/lib/legal/acknowledgement";
const status = (user_id = "A", complete = false): PolicyStatus => ({
  user_id,
  release_id: POLICY_ACKNOWLEDGEMENT_RELEASE,
  complete,
});
const all = () =>
  Object.fromEntries(ACKNOWLEDGEMENT_DOCUMENTS.map((d) => [d.key, true]));
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function fixture() {
  const api = {
    load: vi.fn().mockResolvedValue(status()),
    save: vi.fn().mockResolvedValue(status("A", true)),
  };
  return { api, store: new PolicyConfirmationCoordinator(api) };
}
describe("one-time account policy confirmation", () => {
  it("requires all five platform and three World documents, unchecked by default", () => {
    expect(ACKNOWLEDGEMENT_DOCUMENTS).toHaveLength(8);
    expect(
      ACKNOWLEDGEMENT_DOCUMENTS.filter((d) => d.scope === "world"),
    ).toHaveLength(3);
    expect(Object.values(emptyPolicyChecks())).toEqual(Array(8).fill(false));
    expect(allPoliciesChecked(all())).toBe(true);
    for (const { key } of ACKNOWLEDGEMENT_DOCUMENTS)
      expect(allPoliciesChecked({ ...all(), [key]: false })).toBe(false);
    expect(allPoliciesChecked({ ...all(), extra: true })).toBe(false);
    expect(
      ACKNOWLEDGEMENT_DOCUMENTS.filter((d) => d.action === "read").map(
        (d) => d.key,
      ),
    ).toEqual(["privacy", "world/about", "world/privacy"]);
  });
  it("pins every receipt to the exact published source and version", () => {
    const sql = readFileSync(
      "supabase/migrations/20261021020000_policy_acknowledgement_release.sql",
      "utf8",
    );
    for (const d of ACKNOWLEDGEMENT_DOCUMENTS) {
      const source = manifest.find((s) => s.file === d.file)!;
      expect(sql).toContain(
        `('${d.key}','${d.version}','${d.route}','${source.sha256}','${d.action}')`,
      );
    }
  });
  it("does not refetch on navigation, repeated rendering or token-refresh user objects", async () => {
    const { api, store } = fixture();
    store.setUser("A");
    await flush();
    for (let i = 0; i < 20; i++) {
      store.setUser("A");
      store.getSnapshot();
    }
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().status).toBe("required");
  });
  it("does not save any unchecked or anonymous confirmation", async () => {
    const { api, store } = fixture();
    expect(await store.accept(all())).toBe(false);
    store.setUser("A");
    await flush();
    expect(await store.accept(emptyPolicyChecks())).toBe(false);
    expect(api.save).not.toHaveBeenCalled();
  });
  it("single-flights double clicks and closes only after a successful server receipt", async () => {
    const { api, store } = fixture();
    let resolve!: (s: PolicyStatus) => void;
    api.save.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    store.setUser("A");
    await flush();
    const first = store.accept(all());
    expect(await store.accept(all())).toBe(false);
    expect(store.getSnapshot().saving).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(1);
    resolve(status("A", true));
    expect(await first).toBe(true);
    expect(store.getSnapshot().status).toBe("accepted");
    store.setUser("A");
    expect(await store.accept(all())).toBe(false);
    expect(api.save).toHaveBeenCalledTimes(1);
  });
  it("uses the persisted account receipt after reload or on a different device", async () => {
    const { api, store } = fixture();
    api.load.mockResolvedValue(status("A", true));
    store.setUser("A");
    await flush();
    expect(store.getSnapshot().status).toBe("accepted");
    const another = new PolicyConfirmationCoordinator(api);
    another.setUser("A");
    await flush();
    expect(another.getSnapshot().status).toBe("accepted");
    expect(api.save).not.toHaveBeenCalled();
  });
  it("fails safely and allows explicit retry, without assuming acceptance", async () => {
    const { api, store } = fixture();
    api.load.mockRejectedValueOnce(new Error("offline"));
    store.setUser("A");
    await flush();
    expect(store.getSnapshot().status).toBe("error");
    store.retry();
    await flush();
    expect(store.getSnapshot().status).toBe("required");
    api.save.mockRejectedValueOnce(new Error("offline"));
    const checks = all();
    expect(await store.accept(checks)).toBe(false);
    expect(store.getSnapshot().status).toBe("required");
    expect(checks).toEqual(all());
    expect(await store.accept(checks)).toBe(true);
  });
  it("rejects stale release, wrong-account and incomplete server receipts", async () => {
    for (const result of [{ ...status(), release_id: "old" }, status("B")]) {
      const { api, store } = fixture();
      api.load.mockResolvedValue(result);
      store.setUser("A");
      await flush();
      expect(store.getSnapshot().status).toBe("error");
    }
    const { api, store } = fixture();
    api.save.mockResolvedValue(status());
    store.setUser("A");
    await flush();
    expect(await store.accept(all())).toBe(false);
    expect(store.getSnapshot().status).toBe("required");
  });
  it("discards late reads and saves after account change or logout", async () => {
    const { api, store } = fixture();
    let finishRead!: (s: PolicyStatus) => void;
    api.load
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            finishRead = r;
          }),
      )
      .mockResolvedValue(status("B"));
    store.setUser("A");
    store.setUser("B");
    await flush();
    finishRead(status("A", true));
    await flush();
    expect(store.getSnapshot()).toMatchObject({
      userId: "B",
      status: "required",
    });
    let finishSave!: (s: PolicyStatus) => void;
    api.save.mockImplementation(
      () =>
        new Promise((r) => {
          finishSave = r;
        }),
    );
    const pending = store.accept(all());
    store.setUser(null);
    finishSave(status("B", true));
    expect(await pending).toBe(false);
    expect(store.getSnapshot()).toMatchObject({ userId: null, status: "idle" });
  });
  it("keeps policy reading public and account onboarding behind the single coordinator", () => {
    const gate = readFileSync(
      "components/legal/legal-consent-gate.tsx",
      "utf8",
    );
    expect(gate).toContain('pathname.startsWith("/legal/")');
    expect(gate).toContain('target="_blank"');
    expect(gate).toContain('aria-modal="true"');
    expect(gate).toContain("!allPoliciesChecked(checks)");
    expect(gate).not.toContain("localStorage.getItem");
    const provider = readFileSync(
      "components/legal/policy-acknowledgement-provider.tsx",
      "utf8",
    );
    expect(provider).toContain("[coordinator, userId]");
    expect(provider).not.toContain("usePathname");
    expect(
      readFileSync("components/auth/account-onboarding.tsx", "utf8"),
    ).toContain("if (!policiesConfirmed) return null");
  });
  it("waits for the exact backend and group function activation before publishing the new client", () => {
    const workflow=readFileSync(".github/workflows/deploy-pages.yml","utf8");
    expect(workflow).toContain("Wait for matching scoped policy activation");
    expect(workflow).toContain('--workflow deploy-policy-acknowledgements.yml --commit "$GITHUB_SHA"');
    expect(workflow).toContain('node scripts/publish-policy-acknowledgements.mjs --check-only');
    const activation=readFileSync(".github/workflows/deploy-policy-acknowledgements.yml","utf8");
    expect(activation).toContain('supabase functions deploy register-with-group-code');
    expect(activation).not.toContain('db push');
    expect(activation).not.toContain('deploy-group-registration.mjs');
  });
});
