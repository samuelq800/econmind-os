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
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([null, [], [{ verified: false }], [{ verified:true }, { verified:true }]])("blocks absent or ambiguous evidence", async rows => {
    await expect(checkCredentialEditorReady(async () => rows)).rejects.toThrow("prerequisites are missing");
  });
});
