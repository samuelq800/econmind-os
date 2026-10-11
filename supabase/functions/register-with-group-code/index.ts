import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.7";
import {
  createGroupRegistrationHandler,
  provePendingRegistrationPassword,
  type GroupRegistrationDependencies,
} from "../_shared/group-registration.ts";

Deno.serve(async (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !role || !anon)
    return new Response(
      JSON.stringify({ code: "group_registration_unavailable" }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  const admin = createClient(url, role, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const deps: GroupRegistrationDependencies = {
    authorize: async (code, email, peer) => {
      const { data, error } = await admin.rpc("authorize_group_registration", {
        p_code: code,
        p_email: email,
        p_peer: peer,
      });
      if (error || !data) throw new Error("Registration unavailable");
      return data;
    },
    peerKey: async (peer) => {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(role),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`group-peer:${peer}`),
      );
      return [...new Uint8Array(signature)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    },
    createAccount: async (email, password, metadata, audit) => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: audit,
      });
      if (error || !data.user) throw new Error("Registration rejected");
    },
    provePendingPassword: async (email, password) => {
      return provePendingRegistrationPassword(
        url,
        anon,
        email,
        password,
        async (accessToken) => {
          // A concurrent email verification may have issued a transient session.
          // Close only that session, never the user's other active sessions.
          const { error } = await admin.auth.admin.signOut(
            accessToken,
            "local",
          );
          if (error) throw new Error("Could not close transient session");
        },
      );
    },
    getAccount: async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user) throw new Error("Account unavailable");
      return data.user;
    },
    activateAccount: async (id, appMetadata) => {
      const { error } = await admin.auth.admin.updateUserById(id, {
        email_confirm: true,
        app_metadata: appMetadata,
      });
      if (error) throw new Error("Activation rejected");
    },
  };
  return createGroupRegistrationHandler(deps)(request);
});
