import { getSupabaseBrowserClient } from "./client";
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
  load: (userId: string) =>
    rpc("get_my_policy_acknowledgement_status", { p_expected_user_id: userId }),
  save: (userId: string, checks: PolicyChecks) =>
    rpc("acknowledge_policy_release", {
      p_expected_user_id: userId,
      p_release_id: POLICY_ACKNOWLEDGEMENT_RELEASE,
      p_acknowledgements: checks,
    }),
};
