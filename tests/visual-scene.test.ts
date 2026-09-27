import { describe, expect, it } from "vitest";
import { visualScene } from "../lib/visual-scene";
describe("visual route families",()=>{
  it("covers unknown and nested routes without changing permissions",()=>{expect(visualScene("/admin/mail")).toBe("workspace");expect(visualScene("/new-page")).toBe("workspace");});
  it("preserves Season 1 and quiet reading/workspaces",()=>{expect(visualScene("/season1/my-team")).toBe("season");expect(visualScene("/privacy/")).toBe("reading");expect(visualScene("/models/is-lm")).toBe("workspace");expect(visualScene("/live-auction")).toBe("workspace");});
  it("classifies presentation routes",()=>{expect(visualScene("/")).toBe("showcase");expect(visualScene("/about")).toBe("showroom");expect(visualScene("/profile")).toBe("identity");});
});
