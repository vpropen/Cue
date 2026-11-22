/**
 * Інтеграційні тести сервісів на реальному PostgreSQL.
 * Запускаються, лише якщо задано DATABASE_URL (база з застосованими міграціями 0000–0004).
 * Без нього тести пропускаються, щоб звичайний `pnpm test` не вимагав БД.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, priceChangeRequests, services, staff } from "@cue/db";
import {
  addStaff,
  approveService,
  changeServicePrice,
  createService,
  DomainError,
  registerSalon,
  type Actor,
} from "../src";

const hasDb = Boolean(process.env.DATABASE_URL);

function uniquePhone(): string {
  // Українські мобільні: +380 + 9 цифр; рандомізуємо, щоб тести не конфліктували
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, "0");
  return `+3806${n.slice(0, 8)}`;
}

async function expectDomainError(promise: Promise<unknown>, code: DomainError["code"]) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`Очікувалась помилка ${code}, але операція пройшла`);
}

describe.skipIf(!hasDb)("сервіси на PostgreSQL", () => {
  // Підключення створюємо лише тоді, коли тести реально запускаються (не при збиранні без БД)
  let db: ReturnType<typeof getDb>;
  beforeAll(() => {
    db = getDb();
  });

  async function newSalon() {
    const authUserId = randomUUID();
    const sub = randomUUID().slice(0, 8);
    const reg = await registerSalon(db, {
      authUserId,
      salonName: `Салон ${sub}`,
      businessType: "barber",
      phone: uniquePhone(),
      email: `owner-${sub}@example.com`,
      displayName: "Власник",
      subdomain: `s-${sub}`,
      now: new Date("2026-12-01T10:00:00Z"),
    });
    const owner: Actor = { staffId: reg.ownerStaffId, salonId: reg.salonId, role: "owner" };
    return { reg, owner };
  }

  it("реєстрація створює салон, власника і пробну підписку", async () => {
    const { reg } = await newSalon();
    expect(reg.subdomain).toMatch(/^s-/);
    expect(reg.trialEndsAt.toISOString()).toBe("2027-01-01T10:00:00.000Z");
  });

  it("реєстрація відхиляє зайнятий піддомен", async () => {
    const sub = randomUUID().slice(0, 8);
    const base = {
      businessType: "barber" as const,
      salonName: "X",
      email: `a-${sub}@example.com`,
      displayName: "A",
      subdomain: `dup-${sub}`,
    };
    await registerSalon(db, { ...base, authUserId: randomUUID(), phone: uniquePhone() });
    await expectDomainError(
      registerSalon(db, { ...base, authUserId: randomUUID(), phone: uniquePhone() }),
      "conflict",
    );
  });

  it("реєстрація відхиляє номер, що належить іншому користувачу", async () => {
    const phone = uniquePhone();
    const sub = randomUUID().slice(0, 8);
    await registerSalon(db, {
      authUserId: randomUUID(),
      salonName: "A",
      businessType: "barber",
      phone,
      email: `p1-${sub}@example.com`,
      displayName: "A",
      subdomain: `p1-${sub}`,
    });
    await expectDomainError(
      registerSalon(db, {
        authUserId: randomUUID(),
        salonName: "B",
        businessType: "barber",
        phone,
        email: `p2-${sub}@example.com`,
        displayName: "B",
        subdomain: `p2-${sub}`,
      }),
      "conflict",
    );
  });

  it("реєстрація вимагає email і український номер", async () => {
    await expectDomainError(
      registerSalon(db, {
        authUserId: randomUUID(),
        salonName: "C",
        businessType: "barber",
        phone: "12345",
        email: "",
        displayName: "C",
        subdomain: `c-${randomUUID().slice(0, 8)}`,
      }),
      "validation",
    );
  });

  it("адміністратора створює лише власник; майстра — власник або адміністратор", async () => {
    const { owner, reg } = await newSalon();
    const admin = await addStaff(db, owner, { role: "admin", displayName: "Адмін" });
    const adminActor: Actor = { staffId: admin.id, salonId: reg.salonId, role: "admin" };

    await expectDomainError(addStaff(db, adminActor, { role: "admin", displayName: "Ще адмін" }), "forbidden");
    await addStaff(db, adminActor, { role: "master", displayName: "Майстер" });
  });

  it("ліміт співробітників блокує додавання понад тариф", async () => {
    const { owner } = await newSalon();
    await addStaff(db, owner, { role: "master", displayName: "M1", maxStaff: 2 });
    await expectDomainError(
      addStaff(db, owner, { role: "master", displayName: "M2", maxStaff: 2 }),
      "limit_reached",
    );
  });

  it("послуга від адміністратора очікує підтвердження власника", async () => {
    const { owner, reg } = await newSalon();
    const adminStaff = await addStaff(db, owner, { role: "admin", displayName: "Адмін" });
    const adminActor: Actor = { staffId: adminStaff.id, salonId: reg.salonId, role: "admin" };

    const svc = await createService(db, adminActor, {
      name: "Стрижка",
      price: 300,
      durationMinutes: 60,
      masterIds: [],
    });
    expect(svc.approval).toBe("pending_owner_approval");

    await approveService(db, owner, svc.id);
    const [row] = await db.select().from(services).where(eq(services.id, svc.id));
    expect(row?.approval).toBe("approved");
  });

  it("майстер не створює послуги", async () => {
    const { owner, reg } = await newSalon();
    const m = await addStaff(db, owner, { role: "master", displayName: "M" });
    const masterActor: Actor = { staffId: m.id, salonId: reg.salonId, role: "master" };
    await expectDomainError(
      createService(db, masterActor, { name: "X", price: 1, durationMinutes: 30, masterIds: [] }),
      "forbidden",
    );
  });

  it("тривалість послуги має бути кратна 15 хвилинам", async () => {
    const { owner } = await newSalon();
    await expectDomainError(
      createService(db, owner, { name: "X", price: 1, durationMinutes: 20, masterIds: [] }),
      "validation",
    );
  });

  it("не можна призначити майстра з іншого салону", async () => {
    const a = await newSalon();
    const b = await newSalon();
    const foreignMaster = await addStaff(db, b.owner, { role: "master", displayName: "Чужий" });
    await expectDomainError(
      createService(db, a.owner, {
        name: "X",
        price: 1,
        durationMinutes: 30,
        masterIds: [foreignMaster.id],
      }),
      "forbidden",
    );
  });

  it("адміністратор створює запит на ціну, власник змінює напряму", async () => {
    const { owner, reg } = await newSalon();
    const svc = await createService(db, owner, { name: "Фарбування", price: 500, durationMinutes: 90, masterIds: [] });

    const adminStaff = await addStaff(db, owner, { role: "admin", displayName: "Адмін" });
    const adminActor: Actor = { staffId: adminStaff.id, salonId: reg.salonId, role: "admin" };

    const r1 = await changeServicePrice(db, adminActor, svc.id, 600);
    expect(r1.action).toBe("request_created");
    const [current] = await db.select().from(services).where(eq(services.id, svc.id));
    expect(Number(current?.price)).toBe(500);

    const requests = await db.select().from(priceChangeRequests).where(eq(priceChangeRequests.serviceId, svc.id));
    expect(requests).toHaveLength(1);

    const r2 = await changeServicePrice(db, owner, svc.id, 650);
    expect(r2.action).toBe("applied");
    const [after] = await db.select().from(services).where(eq(services.id, svc.id));
    expect(Number(after?.price)).toBe(650);
  });

  it("майстер не змінює ціну", async () => {
    const { owner, reg } = await newSalon();
    const svc = await createService(db, owner, { name: "M", price: 100, durationMinutes: 30, masterIds: [] });
    const m = await addStaff(db, owner, { role: "master", displayName: "M" });
    const masterActor: Actor = { staffId: m.id, salonId: reg.salonId, role: "master" };
    await expectDomainError(changeServicePrice(db, masterActor, svc.id, 1), "forbidden");
  });

  it("власник бачить створених співробітників у своєму салоні", async () => {
    const { owner } = await newSalon();
    const m = await addStaff(db, owner, { role: "master", displayName: "Видимий" });
    const [row] = await db.select().from(staff).where(eq(staff.id, m.id));
    expect(row?.salonId).toBe(owner.salonId);
  });
});
