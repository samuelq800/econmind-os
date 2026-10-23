import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.7";
import { createDirectRegistrationHandler } from "../_shared/direct-registration.ts";

Deno.serve(async (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL"),
    role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !role) return new Response(null, { status: 503 });
  const admin = createClient(url, role, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return createDirectRegistrationHandler({
    authorize: async (address) => {
      const { data, error } = await admin.rpc("authorize_direct_registration", {
        p_address: address,
      });
      if (error || !data) throw new Error("Registration unavailable");
      return data.status;
    },
    createAccount: async (email, password, user_metadata, app_metadata) => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata,
        app_metadata,
      });
      if (error || !data.user) throw new Error("Registration rejected");
    },
  })(request);
});
