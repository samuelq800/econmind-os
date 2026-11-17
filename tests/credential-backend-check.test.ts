import { describe, expect, it, vi } from "vitest";
import { checkCredentialBackend } from "../scripts/check-credential-backend.mjs";

describe("credential deployment prerequisite", () => {
  it("accepts exactly one positive read-only result", async () => {
    const request = vi.fn(async (query: string) => {
      expect(query).toContain("as verified");
      expect(query).not.toMatch(/\b(insert|update|delete|alter|create)\b/i);
      return [{ verified: true }];
    });
    await expect(checkCredentialBackend(request)).resolves.toBe(true);
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([[], [{ verified: false }], [{ verified: true }, { verified: true }], null])("rejects missing or negative evidence", async evidence => {
    await expect(checkCredentialBackend(async () => evidence)).rejects.toThrow("Credential backend verification failed");
  });
});
