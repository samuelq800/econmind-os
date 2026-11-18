import { describe, expect, it } from "vitest";
import { CREDENTIAL_CATEGORIES } from "@/lib/credentials/wording";
import WORDING_CATALOG_V03 from "./fixtures/credential-handoff-v03.json";
import { authorAppearsInSource, researchChanged, researchReference } from "@/lib/credentials/research-source";
import type { CredentialResearchSource } from "@/lib/supabase/credential-research-sources";

const paper: CredentialResearchSource = {paper_id:"10000000-0000-0000-0000-000000000001",uploader_user_id:"u",author_display_name:"Alice",owner_name_matches:false,coauthors_text:"Bob; Carol",title:"First title",subject:"Economics",institution:"School",status:"published",published_at:null,updated_at:"2026-01-01T00:00:00Z"};
describe("v0.3 supplied wording catalog",()=>{
  it("keeps all 46 current wordings in draft, with all nine categories and 25 archive items",()=>{
    expect(WORDING_CATALOG_V03.templates).toHaveLength(46);
    expect(WORDING_CATALOG_V03.legacy_archive).toHaveLength(25);
    expect(WORDING_CATALOG_V03.templates.every(item=>item.status==="draft")).toBe(true);
    expect(CREDENTIAL_CATEGORIES.map(item=>item.code)).toEqual(["MEM","PAR","CON","LEA","SUP","CLB","DIS","PRT","GSP"]);
  });
  it("uses a dynamic research placeholder instead of a frozen paper list",()=>{
    const template=WORDING_CATALOG_V03.templates.find(item=>item.template_id==="CON-R-LIVE");
    expect(template?.statement).toContain("{paper_title}");
  });
});
describe("research provenance",()=>{
  it("compares the current title, byline, status and update timestamp without silently changing the snapshot",()=>{
    const source=researchReference(paper,"Alice",false);
    expect(researchChanged(source,paper)).toBe(false);
    for(const change of [{title:"Renamed"},{author_display_name:"Alicia"},{coauthors_text:"Bob"},{status:"unpublished"},{updated_at:"2026-02-01T00:00:00Z"}])
      expect(researchChanged(source,{...paper,...change})).toBe(true);
    expect(researchChanged(source,undefined)).toBe(true);
    expect(source.paper_title).toBe("First title");
  });
  it("requires the administrator to select a byline name and separately confirm it",()=>{
    expect(authorAppearsInSource("Alice",paper)).toBe(true);
    expect(authorAppearsInSource("Carol",paper)).toBe(true);
    expect(authorAppearsInSource("Unknown",paper)).toBe(false);
    expect(authorAppearsInSource("Car",paper)).toBe(false);
    expect(researchReference(paper,"Bob",false).verified_author).toBe("Bob");
  });
});
