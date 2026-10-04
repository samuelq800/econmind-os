import { createGatewayHandler } from "./proxy";

export default {
  fetch(request, env) {
    return createGatewayHandler(env.SUPABASE_URL, env.SITE_ORIGIN)(request);
  },
} satisfies ExportedHandler<Env>;
