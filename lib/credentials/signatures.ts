/** Stable versions are saved with each batch and issued credential. */
export const CREDENTIAL_SIGNATURES = [
  { key: "samuel_qian_v1", label: "Samuel Qian", title: "EconMind Initial Founder" },
  { key: "yale_chen_v1", label: "Yale Chen", title: "EconMind Initial Founder" },
] as const;
export type CredentialSignatureKey = (typeof CREDENTIAL_SIGNATURES)[number]["key"];
