import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export type SupabaseOperationError = { message: string } | null | undefined;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;

  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return browserClient;
}

/**
 * Uses the single browser client and preserves the existing fail-fast behaviour
 * for browser features that require Supabase configuration.
 */
export function requireSupabaseBrowserClient(): SupabaseClient {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/** Keeps database and function errors consistent across application services. */
export function throwIfSupabaseError(error: SupabaseOperationError) {
  if (error) throw new Error(error.message);
}
