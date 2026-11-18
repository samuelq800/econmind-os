import { describe, expect, it, vi } from "vitest";
import { checkCredentialEditorReady } from "../scripts/check-credential-editor-ready.mjs";

describe("credential V2 release gate", () => {
  it("requires a positive read-only backend check", async () => {
    const request = vi.fn(async (query: string) => {
      expect(query).toContain("as verified");
      expect(query).not.toMatch(/\b(insert|update|delete|alter|create)\b/i);
      return [{ verified: true }];
    });
    await expect(checkCredentialEditorReady(request)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("blocks release when the v0.3 migration is missing", async () => {
    const request = vi.fn().mockResolvedValueOnce([{ verified: true }]).mockResolvedValueOnce([{ verified: false }]);
    await expect(checkCredentialEditorReady(request)).rejects.toThrow("v0.3 database prerequisites");
  });
  it.each([null, [], [{ verified: false }], [{ verified:true }, { verified:true }]])("blocks absent or ambiguous evidence", async rows => {
    await expect(checkCredentialEditorReady(async () => rows)).rejects.toThrow("prerequisites are missing");
  });
});
