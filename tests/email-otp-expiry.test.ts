import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Standalone Node deployment script intentionally has no TS declaration.
import {
  EMAIL_OTP_EXPIRY_SECONDS,
  setEmailOtpExpiry,
} from "../scripts/set-email-otp-expiry.mjs";

describe("email verification lifetime", () => {
  it("persists a 20-minute email expiry without changing resend cooldown or OTP length", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(EMAIL_OTP_EXPIRY_SECONDS).toBe(1200);
    expect(config).toMatch(/\[auth.email\][\s\S]*?otp_expiry = 1200/);
    expect(config).toContain('max_frequency = "1m0s"');
    expect(config).toContain("otp_length = 8");
  });

  it("patches only the shared expiry and independently reads it back", async () => {
    const before = {
      mailer_otp_exp: 60,
      external_google_enabled: true,
      jwt_exp: 3600,
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ...before, mailer_otp_exp: 1200 });
    await expect(setEmailOtpExpiry(request)).resolves.toEqual({
      beforeSeconds: 60,
      afterSeconds: 1200,
      unrelatedSettingsUnchanged: true,
    });
    expect(request.mock.calls).toEqual([
      ["GET"],
      ["PATCH", { mailer_otp_exp: 1200 }],
      ["GET"],
    ]);
  });

  it("does not write when already configured, but still verifies", async () => {
    const request = vi.fn().mockResolvedValue({ mailer_otp_exp: 1200 });
    await setEmailOtpExpiry(request);
    expect(request.mock.calls).toEqual([["GET"], ["GET"]]);
  });

  it("rejects bad preflight before writing", async () => {
    const request = vi.fn().mockResolvedValue({});
    await expect(setEmailOtpExpiry(request)).rejects.toThrow("preflight");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not claim success if readback differs", async () => {
    const request = vi.fn().mockResolvedValue({ mailer_otp_exp: 60 });
    await expect(setEmailOtpExpiry(request)).rejects.toThrow("readback");
  });

  it("detects unrelated changes without printing credentials or rolling them back", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ mailer_otp_exp: 60, smtp_pass: "private" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ mailer_otp_exp: 1200, smtp_pass: "changed" });
    await expect(setEmailOtpExpiry(request)).rejects.toThrow(
      "Unrelated Auth settings changed",
    );
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("does not retry a failed write", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ mailer_otp_exp: 60 })
      .mockRejectedValueOnce(new Error("HTTP 500"));
    await expect(setEmailOtpExpiry(request)).rejects.toThrow("HTTP 500");
    expect(request).toHaveBeenCalledTimes(2);
  });
});
