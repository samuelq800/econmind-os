import { createSendAdminEmailHandler, mailCors, mailReply } from "../_shared/admin-mail.ts";
import { createMailStore } from "../_shared/admin-mail-store.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: mailCors });
  if (request.method !== "POST") return mailReply({ ok: false, message: "POST only" }, 405, true);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!url || !serviceRole || !brevoApiKey) return mailReply({ ok: false, message: "Protected mail configuration is incomplete." }, 503, true);
  return createSendAdminEmailHandler({ store: createMailStore(url, serviceRole), brevoApiKey })(request);
});
