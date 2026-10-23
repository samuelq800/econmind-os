// Shared by browsers, Edge Functions and native Auth integration tests.
// Keep this module free of browser coordinators and non-erasable TS syntax.
import { LEGAL_POLICY_DOCUMENTS } from "./document-registry.ts";
export const POLICY_ACKNOWLEDGEMENT_RELEASE = "2026-10-21-v2";
export const ACKNOWLEDGEMENT_DOCUMENTS = LEGAL_POLICY_DOCUMENTS.map(
  (document) => ({
    ...document,
    version: document.scope === "world" ? "2026-10-21" : "2.0",
    action: ["privacy", "world/privacy", "world/about"].includes(document.key)
      ? "read"
      : "agree",
  }),
);
export type PolicyChecks = Record<string, boolean>;
export const emptyPolicyChecks = (): PolicyChecks =>
  Object.fromEntries(ACKNOWLEDGEMENT_DOCUMENTS.map(({ key }) => [key, false]));
export function allPoliciesChecked(checks: PolicyChecks) {
  return (
    Object.keys(checks).length === 8 &&
    ACKNOWLEDGEMENT_DOCUMENTS.every(({ key }) => checks[key] === true)
  );
}
