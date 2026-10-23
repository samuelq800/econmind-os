import { getSupabaseBrowserClient } from "./client";
import {
  pendingOAuthRegistrationConsent,
  clearOAuthRegistrationConsent,
} from "@/lib/legal/registration-consent";
import {
  POLICY_ACKNOWLEDGEMENT_RELEASE,
  type PolicyChecks,
  type PolicyStatus,
} from "@/lib/legal/acknowledgement";
async function rpc(
  name: string,
  parameters: Record<string, unknown>,
): Promise<PolicyStatus> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw new Error(error.message);
  return data as PolicyStatus;
}
export const policyAcknowledgementApi = {
  load: async (userId: string) => {
    const status = await rpc("get_my_policy_acknowledgement_status", {
      p_expected_user_id: userId,
    });
    if (typeof window === "undefined") return status;
    const pending = pendingOAuthRegistrationConsent();
    if (!pending) return status;
    // Consume only after a server-confirmed receipt for this exact account.
    const saved = status.complete
      ? status
      : await policyAcknowledgementApi.save(userId, pending);
    if (
      saved.user_id !== userId ||
      saved.release_id !== POLICY_ACKNOWLEDGEMENT_RELEASE ||
      !saved.complete
    )
      throw new Error("Policy receipt was not confirmed");
    clearOAuthRegistrationConsent();
    return saved;
  },
  save: (userId: string, checks: PolicyChecks) =>
    rpc("acknowledge_policy_release", {
      p_expected_user_id: userId,
      p_release_id: POLICY_ACKNOWLEDGEMENT_RELEASE,
      p_acknowledgements: checks,
    }),
};
