import { createBrevoMailEventsHandler, mailReply } from "../_shared/admin-mail.ts";
import { createMailStore } from "../_shared/admin-mail-store.ts";

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return mailReply({ ok: false, message: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = Deno.env.get("BREVO_WEBHOOK_TOKEN");
  if (!url || !serviceRole || !token) return mailReply({ ok: false, message: "Protected mail configuration is incomplete." }, 503);
  return createBrevoMailEventsHandler({ store: createMailStore(url, serviceRole), token })(request);
});
