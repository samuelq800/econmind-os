import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { NAVIGATION_SECTIONS } from "@/lib/platform/feature-flags";
import { pageAccessForPath } from "@/lib/platform/access-control";

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: mocks.getClient,
  requireSupabaseBrowserClient: () => {
    const client = mocks.getClient();
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  },
  throwIfSupabaseError: (error: { message: string } | null | undefined) => { if (error) throw new Error(error.message); },
}));

import { validateResearchPdf } from "@/lib/supabase/research-library";
import { paragraphsFromPdfItems } from "@/lib/research/pdf-text";

const migration = readFileSync("supabase/migrations/20260913000000_research_library.sql", "utf8");
const library = readFileSync("components/research/research-library.tsx", "utf8");

describe("Research Library", () => {
  it("places the archive below Learn without adding a top-level destination", () => {
    const learn = NAVIGATION_SECTIONS.find((section) => section.id === "learn");
    expect(learn?.children).toContainEqual(expect.objectContaining({ href: "/learn/research", label: "Research Library" }));
    expect(NAVIGATION_SECTIONS.some((section) => section.label === "Research Library")).toBe(false);
  });

  it("keeps reading public while requiring individual or administrator access for authoring and review", () => {
    expect(pageAccessForPath("/learn/research").audience).toBe("public");
    expect(pageAccessForPath("/learn/research/paper").audience).toBe("public");
    expect(pageAccessForPath("/learn/research/submit").audience).toBe("account");
    expect(pageAccessForPath("/learn/research/admin").platformRoles).toEqual(["platform_admin"]);
  });

  it("stores only free-text subject and competition metadata, a private PDF bucket, and role-scoped RLS", () => {
    expect(migration).toContain("create table if not exists public.research_papers");
    expect(migration).toContain("subject text not null");
    expect(migration).toContain("competition_text text");
    expect(migration).not.toContain("subject_id");
    expect(migration).not.toContain("competition_id");
    expect(migration).toContain("'research-papers', 'research-papers', false");
    expect(migration).toContain("alter table public.research_papers enable row level security");
    expect(migration).toContain("public.is_platform_admin()");
    expect(migration).toContain("create or replace function public.review_research_paper");
    expect(migration).toContain("p_publication_permission boolean");
  });

  it("validates PDFs before attempting storage upload and exposes review, reader, and status surfaces", () => {
    expect(() => validateResearchPdf({ type: "text/plain", name: "notes.txt", size: 12 } as File)).toThrow("PDF");
    expect(() => validateResearchPdf({ type: "application/pdf", name: "large.pdf", size: 25 * 1024 * 1024 + 1 } as File)).toThrow("25 MB");
    expect(library).toContain("Search papers, authors, schools, subjects or competitions");
    expect(library).toContain("Research Submissions");
    expect(library).toContain("Read Paper");
    expect(library).toContain("Publication permission");
  });

  it("keeps My Research explicitly scoped to the authenticated author", () => {
    const service = readFileSync("lib/supabase/research-library.ts", "utf8");
    expect(service).toContain('supabase.auth.getUser()');
    expect(service).toContain('.eq("owner_user_id", authData.user.id)');
  });

  it("offers a local web reader and preserves readable paragraph boundaries from PDF text items", () => {
    expect(paragraphsFromPdfItems([
      { str: "A short first sentence.", hasEOL: true },
      { str: "A second sentence.", hasEOL: true },
    ])).toEqual(["A short first sentence.", "A second sentence."]);
    expect(library).toContain("Read as web text");
    expect(library).toContain("Text extracted locally from the submitted PDF.");
  });
});
