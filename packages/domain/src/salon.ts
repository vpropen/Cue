/**
 * Правила реєстрації салону: піддомен, пробний період, ліміт співробітників.
 */

/** Пробний період — один місяць (специфікація). */
export const TRIAL_MONTHS = 1;

/** Ліміт робочих місць на звичайній підписці (специфікація). */
export const DEFAULT_MAX_STAFF = 10;

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "cue",
  "mail",
  "support",
  "help",
  "static",
  "cdn",
  "status",
  "docs",
  "blog",
  "login",
  "register",
]);

/** Таблиця транслітерації для автоматичного піддомену з української назви. */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye", ж: "zh", з: "z",
  и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ь: "", ю: "yu", я: "ya", "'": "", "’": "", "ʼ": "",
};

/** Перетворює назву салону на кандидата для піддомену: «Beauty Lab» → «beauty-lab». */
export function slugifySalonName(name: string): string {
  const lower = name.trim().toLowerCase();
  const translit = Array.from(lower)
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("");
  return translit
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

export type SubdomainCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Перевіряє піддомен: 3–30 символів, a–z, 0–9 і дефіс всередині, без зарезервованих назв.
 */
export function validateSubdomain(input: string): SubdomainCheck {
  const value = input.trim().toLowerCase();
  if (value.length < 3 || value.length > 30) {
    return { ok: false, error: "Піддомен має бути від 3 до 30 символів" };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(value) || value.includes("--")) {
    return { ok: false, error: "Допустимі лише латинські літери, цифри і одинарні дефіси всередині" };
  }
  if (RESERVED_SUBDOMAINS.has(value)) {
    return { ok: false, error: "Ця назва зарезервована" };
  }
  return { ok: true, value };
}

/** Дата закінчення пробного періоду: now + TRIAL_MONTHS календарних місяців у UTC. */
export function trialEndsAt(startedAt: Date): Date {
  const d = new Date(startedAt.getTime());
  d.setUTCMonth(d.getUTCMonth() + TRIAL_MONTHS);
  return d;
}

/** Чи дозволено додати ще одного співробітника за лімітом тарифу. */
export function canAddStaff(activeStaffCount: number, maxStaff: number = DEFAULT_MAX_STAFF): boolean {
  return activeStaffCount < maxStaff;
}
