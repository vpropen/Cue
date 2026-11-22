import { describe, expect, it } from "vitest";
import {
  canResendOtp,
  checkOtp,
  chooseVerificationMethod,
  clientStatusAfterVerification,
  generateOtpCode,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "./phone-verification";

const SECRET = "test-secret";
const NOW = new Date("2026-12-01T10:00:00Z");

function record(code: string, overrides: Partial<Parameters<typeof checkOtp>[0]["record"]> = {}) {
  return {
    codeHash: hashOtp(code, SECRET),
    attempts: 0,
    expiresAt: new Date(NOW.getTime() + OTP_TTL_MS),
    consumedAt: null,
    ...overrides,
  };
}

describe("chooseVerificationMethod", () => {
  it("SMS, коли провайдер увімкнено і налаштовано", () => {
    expect(
      chooseVerificationMethod({
        smsEnabled: true,
        smsProvider: "turbosms",
        smsCredentialsConfigured: true,
      }),
    ).toBe("sms_code");
  });

  it.each([
    { smsEnabled: false, smsProvider: "turbosms", smsCredentialsConfigured: true },
    { smsEnabled: true, smsProvider: null, smsCredentialsConfigured: true },
    { smsEnabled: true, smsProvider: "turbosms", smsCredentialsConfigured: false },
  ])("дзвінок адміністратора, якщо SMS не готовий: %o", (input) => {
    expect(chooseVerificationMethod(input)).toBe("admin_call");
  });
});

describe("generateOtpCode", () => {
  it("завжди 6 цифр, із провідними нулями", () => {
    expect(generateOtpCode(() => 42)).toBe("000042");
    expect(generateOtpCode(() => 123456)).toBe("123456");
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
});

describe("checkOtp", () => {
  it("приймає правильний код", () => {
    expect(checkOtp({ record: record("123456"), code: "123456", secret: SECRET, now: NOW })).toEqual({
      ok: true,
    });
  });

  it("відхиляє неправильний код", () => {
    expect(checkOtp({ record: record("123456"), code: "000000", secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("відхиляє прострочений код", () => {
    const later = new Date(NOW.getTime() + OTP_TTL_MS + 1);
    expect(checkOtp({ record: record("123456"), code: "123456", secret: SECRET, now: later })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("блокує після максимуму спроб, навіть з правильним кодом", () => {
    const r = record("123456", { attempts: OTP_MAX_ATTEMPTS });
    expect(checkOtp({ record: r, code: "123456", secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });
  });

  it("не приймає вже використаний код", () => {
    const r = record("123456", { consumedAt: NOW });
    expect(checkOtp({ record: r, code: "123456", secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "consumed",
    });
  });

  it("код, підписаний іншим секретом, не проходить", () => {
    expect(checkOtp({ record: record("123456"), code: "123456", secret: "other", now: NOW })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
});

describe("canResendOtp", () => {
  it("дозволяє перший код і код після паузи 60 секунд", () => {
    expect(canResendOtp(null, NOW)).toBe(true);
    expect(canResendOtp(new Date(NOW.getTime() - 60_000), NOW)).toBe(true);
  });
  it("блокує повтор раніше ніж через 60 секунд", () => {
    expect(canResendOtp(new Date(NOW.getTime() - 59_000), NOW)).toBe(false);
  });
});

describe("clientStatusAfterVerification", () => {
  it("нового клієнта переводить у «підтверджений»", () => {
    expect(clientStatusAfterVerification("pending_confirmation")).toBe("confirmed_no_visits");
  });
  it("інші статуси не змінює", () => {
    expect(clientStatusAfterVerification("confirmed_no_visits")).toBe("confirmed_no_visits");
    expect(clientStatusAfterVerification("has_history")).toBe("has_history");
  });
});
