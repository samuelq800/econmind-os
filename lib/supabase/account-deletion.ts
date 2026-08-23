import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AccountDeletionBlocker =
  | "profile_missing"
  | "privileged_role"
  | "school_affiliation"
  | "team_membership"
  | "league_assignment"
  | "world_membership"
  | "shared_league_history"
  | "shared_authored_content";

export type AccountDeletionEligibility = {
  eligible: boolean;
  blockers: AccountDeletionBlocker[];
};

export const ACCOUNT_DELETION_BLOCKER_MESSAGES: Record<
  AccountDeletionBlocker,
  string
> = {
  profile_missing: "The account profile is unavailable. No data was changed.",
  privileged_role:
    "Teacher, Professor, League administrator, and platform roles require administrator review.",
  school_affiliation: "This account is associated with a school organisation.",
  team_membership:
    "This account belongs to, or is responsible for, a League team.",
  league_assignment:
    "This account still holds a League competition or scenario assignment.",
  world_membership:
    "This account still belongs to the continuous World Simulation.",
  shared_league_history:
    "This account is responsible for shared League or World records that must be preserved.",
  shared_authored_content:
    "This account owns published or shared teaching content.",
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function knownBlockers(value: unknown): AccountDeletionBlocker[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AccountDeletionBlocker =>
      typeof entry === "string" && entry in ACCOUNT_DELETION_BLOCKER_MESSAGES,
  );
}

export async function getAccountDeletionEligibility(): Promise<AccountDeletionEligibility> {
  const { data, error } = await client().rpc(
    "get_self_account_deletion_eligibility",
  );
  if (error) throw new Error(error.message);
  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const blockers = knownBlockers(result.blockers);
  return {
    eligible: result.eligible === true && blockers.length === 0,
    blockers,
  };
}

export async function deletePersonalAccount(confirmation: string) {
  const { data, error } = await client().rpc("delete_self_personal_account", {
    p_confirmation: confirmation,
  });
  if (error) throw new Error(error.message);
  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (result.deleted !== true)
    throw new Error("Account deletion did not complete.");
}

export async function clearDeletedAccountSession(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(
      `econmind.account-onboarding.completed.${userId}`,
    );
  }
}
