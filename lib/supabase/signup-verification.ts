export const EMAIL_OTP_LENGTH = 8;

export const EMAIL_VERIFICATION_CONFIGURATION_ERROR =
  "Email verification is temporarily unavailable. For your security, the new session was closed. Please try again or contact support.";

type SignOutResult = { error: Error | null };

export async function rejectUnexpectedSignupSession(
  session: unknown,
  signOut: () => Promise<SignOutResult>,
) {
  if (!session) return;

  const { error } = await signOut();
  if (error) throw error;
  throw new Error(EMAIL_VERIFICATION_CONFIGURATION_ERROR);
}

export function normaliseEmailOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH);
}
