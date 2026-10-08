import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

export const EMAIL_OTP_EXPIRY_SECONDS = 60 * 60;
export const EMAIL_OTP_PROJECT_REF = "vimksjrhaxdpnkvgsavz";

/** Patch one Auth setting only. Never print provider credentials/config bodies. */
export async function setEmailOtpExpiry(request) {
  const before = await request("GET");
  if (!Number.isInteger(before?.mailer_otp_exp)) {
    throw new Error("Auth expiry preflight did not return an integer");
  }
  if (before.mailer_otp_exp !== EMAIL_OTP_EXPIRY_SECONDS) {
    await request("PATCH", { mailer_otp_exp: EMAIL_OTP_EXPIRY_SECONDS });
  }
  const after = await request("GET");
  if (after?.mailer_otp_exp !== EMAIL_OTP_EXPIRY_SECONDS) {
    throw new Error("Auth expiry readback did not confirm 3600 seconds");
  }
  const unchanged = (config) =>
    Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== "mailer_otp_exp"),
    );
  if (!isDeepStrictEqual(unchanged(before), unchanged(after))) {
    throw new Error(
      "Unrelated Auth settings changed during verification; investigate without automatic rollback",
    );
  }
  return {
    beforeSeconds: before.mailer_otp_exp,
    afterSeconds: after.mailer_otp_exp,
    unrelatedSettingsUnchanged: true,
  };
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const project = process.env.SUPABASE_PROJECT_REF;
  if (!token || project !== EMAIL_OTP_PROJECT_REF) {
    throw new Error(
      "The approved EconMind production Auth configuration is required",
    );
  }
  const receipt = await setEmailOtpExpiry(async (method, payload) => {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${project}/config/auth`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Auth configuration ${method} failed (HTTP ${response.status})`,
      );
    return response.json();
  });
  console.log(JSON.stringify(receipt));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
