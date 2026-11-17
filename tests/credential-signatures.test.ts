import { expect, it } from "vitest";
import { CREDENTIAL_SIGNATURES } from "@/lib/credentials/signatures";

it("offers two versioned signers with the same founding title", () => {
  expect(CREDENTIAL_SIGNATURES.map(signature => signature.key)).toEqual(["samuel_qian_v1", "yale_chen_v1"]);
  expect(new Set(CREDENTIAL_SIGNATURES.map(signature => signature.title))).toEqual(new Set(["EconMind Initial Founder"]));
});
