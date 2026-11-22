/**
 * Розрахунок вільних слотів. Єдине джерело правди для кабінету і бота.
 * Етап 0: лише базові константи і утиліти. Повний алгоритм — Етап 2.
 */

/** Мінімальний таймслот у хвилинах (специфікація: 15 хв). */
export const SLOT_MINUTES = 15;

/**
 * Скільки таймслотів займає тривалість у хвилинах.
 * Тривалість має бути кратна SLOT_MINUTES, інакше кидає помилку.
 */
export function durationToSlots(durationMinutes: number): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError(`Тривалість має бути додатним цілим числом, отримано ${durationMinutes}`);
  }
  if (durationMinutes % SLOT_MINUTES !== 0) {
    throw new RangeError(
      `Тривалість ${durationMinutes} хв не кратна ${SLOT_MINUTES} хв`,
    );
  }
  return durationMinutes / SLOT_MINUTES;
}

/** Сумарна тривалість кількох послуг у хвилинах (для вікна запису). */
export function totalDuration(durations: readonly number[]): number {
  return durations.reduce((sum, d) => sum + d, 0);
}
