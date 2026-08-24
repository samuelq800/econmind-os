export const EMAIL_OTP_LENGTH = 8;
export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;

export const EMAIL_VERIFICATION_CONFIGURATION_ERROR =
  "Email verification is temporarily unavailable. For your security, the new session was closed. Please try again or contact support.";

type AuthErrorDetails = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

function getAuthErrorDetails(caught: unknown): AuthErrorDetails {
  if (typeof caught !== "object" || caught === null) return {};
  const value = caught as Record<string, unknown>;
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    message:
      caught instanceof Error
        ? caught.message
        : typeof value.message === "string"
          ? value.message
          : undefined,
    name:
      caught instanceof Error
        ? caught.name
        : typeof value.name === "string"
          ? value.name
          : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
  };
}

export function isAuthEmailRateLimitError(caught: unknown) {
  const { code, status } = getAuthErrorDetails(caught);
  return (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  );
}

export function authEmailRequestErrorMessage(
  caught: unknown,
  fallback: string,
) {
  const { code, message = "", name, status } = getAuthErrorDetails(caught);
  const normalisedMessage = message.toLowerCase();

  if (message === EMAIL_VERIFICATION_CONFIGURATION_ERROR) return message;
  if (isAuthEmailRateLimitError(caught)) {
    return "Too many email requests. Please wait a minute before trying again.";
  }
  if (
    code === "email_address_invalid" ||
    /invalid email|valid email address/.test(normalisedMessage)
  ) {
    return "Enter a valid email address.";
  }
  if (code === "weak_password") {
    return "The password does not meet the account security requirements.";
  }
  if (code === "email_address_not_authorized") {
    return "This deployment cannot send authentication email to that address. Contact support if you believe this is a mistake.";
  }
  if (
    code === "signup_disabled" ||
    code === "email_provider_disabled" ||
    code === "provider_disabled"
  ) {
    return "Email authentication is temporarily unavailable.";
  }
  if (
    name === "AuthRetryableFetchError" ||
    /failed to fetch|network request|networkerror/.test(normalisedMessage)
  ) {
    return "We could not reach the authentication service. Check your connection and try again.";
  }
  if (
    code === "unexpected_failure" ||
    (typeof status === "number" && status >= 500) ||
    /smtp|send.*email|email.*send/.test(normalisedMessage)
  ) {
    return "Authentication email could not be sent right now. Please try again later.";
  }

  return fallback;
}

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
