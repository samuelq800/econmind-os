import { createClient } from "npm:@supabase/supabase-js@2";
import type { MailStore } from "./admin-mail.ts";

/** Same privileged-client/getUser(token) pattern as moderate-account-access. */
export function createMailStore(url: string, serviceRole: string): MailStore {
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      return { user: data.user ? { id: data.user.id } : null, error: error ? { code: error.code } : null };
    },
    async getProfile(userId) {
      const { data, error } = await admin.from("profiles").select("platform_role,display_name").eq("user_id", userId).maybeSingle();
      return { profile: data, error: error ? { code: error.code } : null };
    },
    async rpc(name, args) {
      const { data, error } = await admin.rpc(name, args);
      return { data, error: error ? { code: error.code } : null };
    },
  };
}
