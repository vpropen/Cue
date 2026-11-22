/**
 * Підтвердження номера телефону клієнта.
 *
 * Два шляхи:
 * - SMS-код: якщо в салоні увімкнено і налаштовано SMS-провайдер.
 * - Дзвінок адміністратора: якщо SMS немає. Адміністратор вручну позначає номер підтвердженим.
 *
 * УВАГА: функції з node:crypto. Викликати лише на сервері, не в браузерному коді.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export type PhoneVerificationMethod = "sms_code" | "admin_call";

/** Який спосіб доступний салону. SMS — лише якщо провайдер увімкнено і налаштовано. */
export function chooseVerificationMethod(input: {
  smsEnabled: boolean;
  smsProvider: string | null;
  smsCredentialsConfigured: boolean;
}): PhoneVerificationMethod {
  const smsReady = input.smsEnabled && !!input.smsProvider && input.smsCredentialsConfigured;
  return smsReady ? "sms_code" : "admin_call";
}

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** Випадковий числовий код із OTP_LENGTH цифр з криптостійким генератором. */
export function generateOtpCode(random: (max: number) => number = randomInt): string {
  const max = 10 ** OTP_LENGTH;
  return String(random(max)).padStart(OTP_LENGTH, "0");
}

/** HMAC-SHA256 коду з серверним секретом. Сам код у БД не зберігається. */
export function hashOtp(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("hex");
}

export type OtpRecord = {
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type OtpCheckResult =
  | { ok: true }
  | { ok: false; reason: "consumed" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Перевіряє введений код. Лічильник спроб збільшує викликач на основі поля `attempts`
 * у результаті: і при помилковому коді, і при успіху спроба враховується.
 */
export function checkOtp(input: {
  record: OtpRecord;
  code: string;
  secret: string;
  now: Date;
}): OtpCheckResult {
  const { record, code, secret, now } = input;
  if (record.consumedAt) return { ok: false, reason: "consumed" };
  if (now.getTime() > record.expiresAt.getTime()) return { ok: false, reason: "expired" };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashOtp(code.trim(), secret), "hex");
  const equal = expected.length === actual.length && timingSafeEqual(expected, actual);
  return equal ? { ok: true } : { ok: false, reason: "mismatch" };
}

/** Чи можна надіслати новий код, з урахуванням паузи між відправками. */
export function canResendOtp(lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= OTP_RESEND_COOLDOWN_MS;
}

/**
 * Статус клієнта після підтвердження номера. Лише «очікує підтвердження»
 * переходить у «підтверджений без візитів»; інші статуси не змінюються.
 */
export function clientStatusAfterVerification(
  current: "pending_confirmation" | "confirmed_no_visits" | "has_history",
): "pending_confirmation" | "confirmed_no_visits" | "has_history" {
  return current === "pending_confirmation" ? "confirmed_no_visits" : current;
}
