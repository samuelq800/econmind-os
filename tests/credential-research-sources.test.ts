import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCredentialResearchSources } from "@/lib/supabase/credential-research-sources";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  requireSupabaseBrowserClient: () => ({ rpc }),
  throwIfSupabaseError: (error: unknown) => { if (error) throw error; },
}));

beforeEach(() => rpc.mockReset());
const paper = (n: number) => ({
  paper_id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
  uploader_user_id: "uploader", author_display_name: "Author",
  coauthors_text: "Unverified coauthor", title: `Paper ${n}`, subject: "Economics",
  institution: "School", status: "published", published_at: null, updated_at: "now",
});

describe("credential research sources", () => {
  it("continues past 100 records and preserves the author, uploader and coauthor fields independently", async () => {
    rpc.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => paper(i + 1)), error: null })
      .mockResolvedValueOnce({ data: [paper(101)], error: null });
    const items = await listCredentialResearchSources();
    expect(items).toHaveLength(101);
    expect(items[0]).toMatchObject({ uploader_user_id: "uploader", author_display_name: "Author", coauthors_text: "Unverified coauthor" });
    expect(rpc).toHaveBeenLastCalledWith("list_credential_research_sources", { p_after_id: paper(100).paper_id, p_limit: 100 });
  });

  it("fails closed on backend errors or repeated and out-of-order identifiers", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    await expect(listCredentialResearchSources()).rejects.toThrow("denied");
    rpc.mockResolvedValueOnce({ data: [paper(2), paper(1)], error: null });
    await expect(listCredentialResearchSources()).rejects.toThrow("invalid order");
  });
});
