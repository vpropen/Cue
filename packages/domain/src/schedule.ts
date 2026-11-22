/**
 * Графік: салон має пріоритет над майстром. Вихідний або свято салону — майстер не працює.
 * Відпустка або вихідний майстра блокують його записи на період.
 * Дати — рядки YYYY-MM-DD (календарна дата салону, без часу).
 */

export type ScheduleRow = {
  type: "working" | "salon_day_off" | "holiday";
  /** 0 = неділя … 6 = субота; або конкретна дата */
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string | null; // "HH:MM"
  endTime: string | null;
};

export type TimeOffRow = { startsOn: string; endsOn: string };

export type Window = { start: string; end: string }; // "HH:MM"

/** День тижня для дати YYYY-MM-DD (0 = неділя). Рахується в UTC, щоб не залежати від сервера. */
export function dayOfWeekOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function matches(row: ScheduleRow, date: string): boolean {
  if (row.specificDate !== null) return row.specificDate === date;
  return row.dayOfWeek !== null && row.dayOfWeek === dayOfWeekOf(date);
}

/** Конкретна дата має пріоритет над днем тижня. */
function rowsFor(rows: ScheduleRow[], date: string): ScheduleRow[] {
  const specific = rows.filter((r) => r.specificDate === date);
  if (specific.length > 0) return specific;
  return rows.filter((r) => r.specificDate === null && matches(r, date));
}

export function isInTimeOff(timeOff: TimeOffRow[], date: string): boolean {
  return timeOff.some((t) => t.startsOn <= date && date <= t.endsOn);
}

/** Чи зачинений салон цього дня (вихідний або свято). */
export function isSalonClosed(salonRows: ScheduleRow[], date: string): boolean {
  return rowsFor(salonRows, date).some((r) => r.type === "salon_day_off" || r.type === "holiday");
}

/**
 * Робочі вікна майстра на дату з урахуванням салону.
 * Порядок правил: салон зачинений → []; відпустка майстра → []; далі вікна майстра,
 * обрізані робочими годинами салону, якщо салон їх задає на цей день.
 */
export function masterWorkingWindows(input: {
  date: string;
  salon: ScheduleRow[];
  master: ScheduleRow[];
  timeOff: TimeOffRow[];
}): Window[] {
  const { date, salon, master, timeOff } = input;
  if (isSalonClosed(salon, date)) return [];
  if (isInTimeOff(timeOff, date)) return [];

  const masterWindows = rowsFor(master, date)
    .filter((r) => r.type === "working" && r.startTime && r.endTime)
    .map((r) => ({ start: r.startTime as string, end: r.endTime as string }));

  const salonHours = rowsFor(salon, date).filter((r) => r.type === "working" && r.startTime && r.endTime);
  if (salonHours.length === 0) return masterWindows;

  const salonStart = salonHours.map((r) => r.startTime as string).sort()[0] as string;
  const salonEnd = salonHours.map((r) => r.endTime as string).sort().reverse()[0] as string;

  return masterWindows
    .map((w) => ({
      start: w.start > salonStart ? w.start : salonStart,
      end: w.end < salonEnd ? w.end : salonEnd,
    }))
    .filter((w) => w.start < w.end);
}
