/**
 * Перевірка контактів: телефон (основний ідентифікатор) і email (реєстрація салону).
 * Етап 1: приймаємо лише українські номери (+380). Міжнародні — пізніше.
 */

/**
 * Нормалізує український номер до формату E.164 (+380XXXXXXXXX).
 * Приймає: +380 67 123 45 67, 380671234567, 0671234567, з пробілами і дефісами.
 * Повертає null, якщо номер не розпізнано.
 */
export function normalizeUaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  let national: string | null = null;
  if (digits.length === 12 && digits.startsWith("380")) {
    national = digits.slice(3);
  } else if (digits.length === 10 && digits.startsWith("0")) {
    national = digits.slice(1);
  }

  // Після коду країни мають бути 9 цифр і перша — не 0 і не 1 (їх немає в мобільних/міських українських номерах)
  if (!national || !/^[2-9]\d{8}$/.test(national)) {
    return null;
  }
  return `+380${national}`;
}

export function isValidUaPhone(input: string): boolean {
  return normalizeUaPhone(input) !== null;
}

/** Просте, але достатнє для форм перевірка email. Підтвердження — листом. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(input: string): boolean {
  return input.length <= 254 && EMAIL_RE.test(input.trim());
}

export type SalonRegistrationContact = {
  phone: string;
  email: string;
};

/**
 * Перевіряє контакти власника салону при реєстрації.
 * І телефон, і email обов'язкові. Повертає помилки по полях.
 */
export function validateSalonRegistrationContact(input: {
  phone: string;
  email: string;
}): { ok: true; value: SalonRegistrationContact } | { ok: false; errors: Partial<Record<"phone" | "email", string>> } {
  const errors: Partial<Record<"phone" | "email", string>> = {};

  const phone = normalizeUaPhone(input.phone);
  if (!phone) errors.phone = "Вкажіть український номер телефону, наприклад +380 67 123 45 67";

  if (!input.email.trim()) errors.email = "Електронна пошта обов'язкова";
  else if (!isValidEmail(input.email)) errors.email = "Некоректна електронна пошта";

  if (errors.phone || errors.email || !phone) return { ok: false, errors };
  return { ok: true, value: { phone, email: input.email.trim().toLowerCase() } };
}
