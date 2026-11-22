import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "./roles";
import {
  canAddStaff,
  slugifySalonName,
  trialEndsAt,
  validateSubdomain,
} from "./salon";
import {
  canAssignServiceToMaster,
  decidePriceChange,
  decideServiceCreation,
  isMasterSelectable,
  isServiceBookable,
} from "./services";
import {
  isLocked,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  registerFailedLogin,
  registerSuccessfulLogin,
} from "./login-lockout";
import { dayOfWeekOf, masterWorkingWindows, type ScheduleRow } from "./schedule";

describe("roles", () => {
  it("власник має всі права", () => {
    for (const p of PERMISSIONS) expect(can("owner", p)).toBe(true);
  });

  it("адміністратор не змінює ціни і не створює адміністраторів", () => {
    expect(can("admin", "price.edit")).toBe(false);
    expect(can("admin", "price.request")).toBe(true);
    expect(can("admin", "staff.create_admin")).toBe(false);
    expect(can("admin", "staff.create_master")).toBe(true);
    expect(can("admin", "service.approve")).toBe(false);
  });

  it("майстер бачить лише своє", () => {
    expect(can("master", "booking.manage_all")).toBe(false);
    expect(can("master", "client.view_all")).toBe(false);
    expect(can("master", "stats.view_all")).toBe(false);
    expect(can("master", "schedule.salon.edit")).toBe(false);
    expect(can("master", "booking.manage_own")).toBe(true);
  });
});

describe("salon", () => {
  it("генерує піддомен з української назви", () => {
    expect(slugifySalonName("Бʼюті Лаб")).toBe("byuti-lab");
    expect(slugifySalonName("  Beauty  Lab!  ")).toBe("beauty-lab");
  });

  it("валідує піддомен", () => {
    expect(validateSubdomain("beauty-lab")).toEqual({ ok: true, value: "beauty-lab" });
    expect(validateSubdomain("ab").ok).toBe(false);
    expect(validateSubdomain("-bad").ok).toBe(false);
    expect(validateSubdomain("bad-").ok).toBe(false);
    expect(validateSubdomain("a--b").ok).toBe(false);
    expect(validateSubdomain("salon_1").ok).toBe(false);
    expect(validateSubdomain("admin").ok).toBe(false);
  });

  it("пробний період — один місяць", () => {
    expect(trialEndsAt(new Date("2026-12-01T10:00:00Z")).toISOString()).toBe(
      "2027-01-01T10:00:00.000Z",
    );
  });

  it("ліміт співробітників: 10 на звичайній підписці", () => {
    expect(canAddStaff(9)).toBe(true);
    expect(canAddStaff(10)).toBe(false);
  });
});

describe("services", () => {
  it("власник створює послугу одразу, адміністратор — з підтвердженням власника", () => {
    expect(decideServiceCreation("owner")).toEqual({ allowed: true, approval: "approved" });
    expect(decideServiceCreation("admin")).toEqual({
      allowed: true,
      approval: "pending_owner_approval",
    });
    expect(decideServiceCreation("master").allowed).toBe(false);
  });

  it("ціна: власник змінює напряму, адміністратор надсилає запит", () => {
    expect(decidePriceChange("owner")).toEqual({ action: "applied" });
    expect(decidePriceChange("admin")).toEqual({ action: "request_created" });
    expect(decidePriceChange("master").action).toBe("denied");
  });

  it("послугу призначають лише майстрам", () => {
    expect(canAssignServiceToMaster("admin", "master")).toBe(true);
    expect(canAssignServiceToMaster("admin", "admin")).toBe(false);
    expect(canAssignServiceToMaster("master", "master")).toBe(false);
  });

  it("послуга бронюється лише активна, підтверджена і з майстром", () => {
    const ok = { status: "active", approval: "approved", activeMasters: 1 } as const;
    expect(isServiceBookable(ok)).toBe(true);
    expect(isServiceBookable({ ...ok, status: "disabled" })).toBe(false);
    expect(isServiceBookable({ ...ok, approval: "pending_owner_approval" })).toBe(false);
    expect(isServiceBookable({ ...ok, activeMasters: 0 })).toBe(false);
  });

  it("майстер без послуг не відображається у виборі", () => {
    expect(isMasterSelectable(0)).toBe(false);
    expect(isMasterSelectable(1)).toBe(true);
  });
});

describe("login lockout (тільки співробітники)", () => {
  const now = new Date("2026-12-01T10:00:00Z");

  it("блокує після 5 невдалих спроб на 15 хвилин", () => {
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      state = registerFailedLogin("staff", state, now);
      expect(isLocked("staff", state, now)).toBe(false);
    }
    state = registerFailedLogin("staff", state, now);
    expect(isLocked("staff", state, now)).toBe(true);
    expect(isLocked("staff", state, new Date(now.getTime() + LOCK_DURATION_MS + 1))).toBe(false);
  });

  it("клієнтів не блокує", () => {
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let i = 0; i < 10; i++) state = registerFailedLogin("client", state, now);
    expect(isLocked("client", state, now)).toBe(false);
    expect(state.failedLoginCount).toBe(0);
  });

  it("успішний вхід скидає лічильник", () => {
    expect(registerSuccessfulLogin()).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });
});

describe("schedule", () => {
  const salonHours: ScheduleRow[] = [
    { type: "working", dayOfWeek: 1, specificDate: null, startTime: "09:00", endTime: "20:00" },
  ];
  const masterMonday: ScheduleRow[] = [
    { type: "working", dayOfWeek: 1, specificDate: null, startTime: "10:00", endTime: "18:00" },
  ];
  const monday = "2026-12-07"; // понеділок
  expect(dayOfWeekOf(monday)).toBe(1);

  it("вікна майстра обрізаються робочими годинами салону", () => {
    const windows = masterWorkingWindows({
      date: monday,
      salon: salonHours,
      master: [{ ...masterMonday[0]!, startTime: "08:00", endTime: "22:00" }],
      timeOff: [],
    });
    expect(windows).toEqual([{ start: "09:00", end: "20:00" }]);
  });

  it("вихідний салону має пріоритет над графіком майстра", () => {
    const salonOff: ScheduleRow[] = [
      { type: "salon_day_off", dayOfWeek: null, specificDate: monday, startTime: null, endTime: null },
    ];
    expect(
      masterWorkingWindows({ date: monday, salon: salonOff, master: masterMonday, timeOff: [] }),
    ).toEqual([]);
  });

  it("відпустка майстра блокує день", () => {
    expect(
      masterWorkingWindows({
        date: monday,
        salon: [],
        master: masterMonday,
        timeOff: [{ startsOn: "2026-12-05", endsOn: "2026-12-10" }],
      }),
    ).toEqual([]);
  });

  it("конкретна дата має пріоритет над днем тижня", () => {
    const override: ScheduleRow[] = [
      { type: "working", dayOfWeek: null, specificDate: monday, startTime: "12:00", endTime: "15:00" },
    ];
    expect(
      masterWorkingWindows({ date: monday, salon: [], master: [...masterMonday, ...override], timeOff: [] }),
    ).toEqual([{ start: "12:00", end: "15:00" }]);
  });

  it("день без робочого графіка майстра — порожньо", () => {
    expect(
      masterWorkingWindows({ date: "2026-12-08", salon: [], master: masterMonday, timeOff: [] }),
    ).toEqual([]);
  });
});
