import { describe, expect, it } from "vitest";
import { approvedWording, blankWording, CREDENTIAL_CATEGORIES, wordingFrom, type WordingVersion } from "../lib/credentials/wording";

describe("credential wording framework", () => {
  it("reserves all requested categories and subtypes without publishing wording", () => {
    expect(CREDENTIAL_CATEGORIES.map(category => category.code)).toEqual(["MEM", "PAR", "CON", "LEA", "SUP", "CLB", "DIS", "PRT", "GSP"]);
    expect(CREDENTIAL_CATEGORIES.every(category => category.subtypes.length > 0)).toBe(true);
    expect(CREDENTIAL_CATEGORIES.find(category => category.code === "LEA")?.subtypes).toContain("Initial Founder");
    expect(Object.values(blankWording()).every(value => value === "")).toBe(true);
  });
  it("separates versions and returns only explicitly approved wording", () => {
    const base = { category:"LEA", subtype:"Initial Founder", template_name:"Official", version:1, text_content:blankWording(), created_at:"2026-01-01" } as const;
    const versions: WordingVersion[] = [{...base,id:"draft",status:"draft"},{...base,id:"approved",status:"approved"},{...base,id:"archived",status:"archived"}];
    expect(approvedWording(versions,"LEA","Initial Founder").map(item => item.id)).toEqual(["approved"]);
    const original = { title:"Certificate" };
    const copy = wordingFrom(original); copy.title="Edited";
    expect(original.title).toBe("Certificate");
    expect(copy.certification_statement).toBe("");
  });
});
