import type { SupabaseClient } from "@supabase/supabase-js";
import {
  directAccountAddress,
  validRegistrationId,
} from "./account-identifier";

export async function signInWithAccountIdentifier(
  client: SupabaseClient,
  identifier: string,
  password: string,
) {
  if (!validRegistrationId(identifier))
    throw new Error("Enter your email or login ID.");
  return client.auth.signInWithPassword({
    email: await directAccountAddress(identifier),
    password,
  });
}
