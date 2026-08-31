import { createClient } from "npm:@supabase/supabase-js@2";

const DESIGNATED_ADMIN_ID = "ffc87a95-f535-4781-9c2d-c2fac962ea9e";
const DESIGNATED_TARGET_ID = "1396ed21-aef3-4827-a2b9-dd25d4be21a7";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

type TargetAuthUser = { banned_until?: string | null };

function accountIsBanned(user: TargetAuthUser) {
  const until = user.banned_until ? Date.parse(user.banned_until) : Number.NaN;
  return Number.isFinite(until) && until > Date.now();
}

function isPendingAccessStateSchema(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST204" || /account_status|schema cache/i.test(error?.message ?? "");
}

async function requireDesignatedAdmin(request: Request, admin: ReturnType<typeof createClient>) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication is required.");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new Error("Your session is invalid.");
  if (auth.user.id !== DESIGNATED_ADMIN_ID) throw new Error("This account control is not available to this user.");
  const { data: profile, error: profileError } = await admin.from("profiles").select("platform_role").eq("user_id", auth.user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (profile?.platform_role !== "platform_admin") throw new Error("Platform administrator permission is required.");
  return auth.user.id;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply({ ok: false, message: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return reply({ ok: false, message: "Protected account-control configuration is incomplete." }, 500);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  try {
    const actorUserId = await requireDesignatedAdmin(request, admin);
    const payload = await request.json().catch(() => ({})) as { action?: "status" | "suspend" | "restore" };
    const action = payload.action;
    if (action !== "status" && action !== "suspend" && action !== "restore") return reply({ ok: false, message: "A valid account action is required." }, 400);

    const { data: authTarget, error: authTargetError } = await admin.auth.admin.getUserById(DESIGNATED_TARGET_ID);
    if (authTargetError) throw new Error(authTargetError.message);
    if (!authTarget.user) return reply({ ok: false, message: "The designated account was not found." }, 404);

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("account_status, account_status_changed_at")
      .eq("user_id", DESIGNATED_TARGET_ID)
      .maybeSingle();
    if (targetError && !isPendingAccessStateSchema(targetError)) throw new Error(targetError.message);

    const suspended = !targetError && target ? target.account_status === "suspended" : accountIsBanned(authTarget.user as TargetAuthUser);
    const changedAt = !targetError && target?.account_status_changed_at ? target.account_status_changed_at : null;
    if (action === "status") return reply({ ok: true, suspended, changedAt });

    const nextSuspended = action === "suspend";
    if (nextSuspended !== suspended) {
      // This uses only the server-side service role. The browser never receives it.
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(DESIGNATED_TARGET_ID, {
        ban_duration: nextSuspended ? "876000h" : "none",
      });
      if (authUpdateError) throw new Error(authUpdateError.message);

      const changedAt = new Date().toISOString();
      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({
          account_status: nextSuspended ? "suspended" : "active",
          account_status_changed_at: changedAt,
          account_status_changed_by: actorUserId,
        })
        .eq("user_id", DESIGNATED_TARGET_ID);
      if (profileUpdateError && !isPendingAccessStateSchema(profileUpdateError)) throw new Error(profileUpdateError.message);

      const { error: auditError } = await admin.from("moderation_actions").insert({
        actor_user_id: actorUserId,
        target_type: "account",
        target_reference: DESIGNATED_TARGET_ID,
        action: nextSuspended ? "access_restricted" : "access_restored",
        outcome: nextSuspended ? "Designated account suspended from the administrator menu." : "Designated account access restored from the administrator menu.",
      });
      if (auditError) throw new Error(auditError.message);
      return reply({ ok: true, suspended: nextSuspended, changedAt });
    }

    return reply({ ok: true, suspended, changedAt });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Account access control failed.";
    return reply({ ok: false, message }, /permission|authentication|session/i.test(message) ? 403 : 500);
  }
});
