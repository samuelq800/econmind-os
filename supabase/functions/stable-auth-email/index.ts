import { createStableEmailHook } from "../_shared/stable-email-codes.ts";
import { stableEmailDependencies } from "../_shared/stable-email-runtime.ts";

Deno.serve(async (request: Request) => {
  try {
    return await createStableEmailHook(stableEmailDependencies())(request);
  } catch {
    return new Response(
      JSON.stringify({
        error: { http_code: 503, message: "Authentication email unavailable." },
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }
});
