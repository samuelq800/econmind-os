import { createVerifyCodeHandler } from "../_shared/stable-email-codes.ts";
import { stableEmailDependencies } from "../_shared/stable-email-runtime.ts";

Deno.serve(async (request: Request) => {
  try {
    return await createVerifyCodeHandler(stableEmailDependencies())(request);
  } catch {
    return new Response(
      JSON.stringify({
        code: "service_unavailable",
        message: "Verification unavailable.",
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
