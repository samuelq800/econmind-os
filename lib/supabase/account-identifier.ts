/** Direct-entry IDs occupy a separate namespace and never assert email ownership. */
export function normalizeRegistrationId(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}
export function validRegistrationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    normalizeRegistrationId(value).length >= 1 &&
    normalizeRegistrationId(value).length <=
      (isRecoveryEmail(value) ? 254 : 128) &&
    ![...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}
export const isRecoveryEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export async function directAccountAddress(identifier: string) {
  if (!validRegistrationId(identifier))
    throw new Error(
      "Enter a login ID of 1–128 characters without control characters.",
    );
  if (isRecoveryEmail(identifier)) return normalizeRegistrationId(identifier);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `econmind-direct-v1:${normalizeRegistrationId(identifier)}`,
    ),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `id-${hex}@accounts.econmind.invalid`;
}
