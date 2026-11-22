/**
 * Блокування після невдалих входів (D9): 5 спроб, блокування на 15 хвилин.
 * Блокуються ЛИШЕ співробітники. Клієнтів не блокуємо (специфікація).
 * Розблокування адміністратором — окрема дія, тут не моделюється.
 */

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export type LoginState = {
  failedLoginCount: number;
  lockedUntil: Date | null;
};

export type AccountType = "staff" | "client";

/** Чи заблокований вхід зараз. Для клієнтів завжди false. */
export function isLocked(type: AccountType, state: LoginState, now: Date): boolean {
  if (type === "client") return false;
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** Стан після невдалої спроби. Для клієнтів лічильник не ведеться. */
export function registerFailedLogin(type: AccountType, state: LoginState, now: Date): LoginState {
  if (type === "client") return state;
  const count = state.failedLoginCount + 1;
  if (count >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: count, lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) };
  }
  return { failedLoginCount: count, lockedUntil: null };
}

/** Стан після успішного входу: лічильник і блокування скидаються. */
export function registerSuccessfulLogin(): LoginState {
  return { failedLoginCount: 0, lockedUntil: null };
}
