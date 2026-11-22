import { and, eq, inArray } from "drizzle-orm";
import { priceChangeRequests, serviceMasters, services, staff } from "@cue/db";
import {
  canAssignServiceToMaster,
  decidePriceChange,
  decideServiceCreation,
  can,
} from "@cue/domain";
import { durationToSlots } from "@cue/availability";
import { DomainError } from "./errors";
import type { Actor } from "./staff";
import type { DbClient } from "./register-salon";

export type CreateServiceInput = {
  name: string;
  price: number;
  durationMinutes: number;
  masterIds: string[];
};

/**
 * Створює послугу і призначає майстрів.
 * Власник — послуга одразу активна. Адміністратор — очікує підтвердження власника.
 */
export async function createService(db: DbClient, actor: Actor, input: CreateServiceInput) {
  const decision = decideServiceCreation(actor.role);
  if (!decision.allowed) throw new DomainError(decision.reason, "forbidden");

  if (!input.name.trim()) {
    throw new DomainError("Вкажіть назву послуги", "validation", { name: "Обов'язкове поле" });
  }
  if (!(input.price >= 0)) {
    throw new DomainError("Ціна не може бути від'ємною", "validation", { price: "Некоректна ціна" });
  }
  try {
    durationToSlots(input.durationMinutes);
  } catch (err) {
    throw new DomainError(err instanceof Error ? err.message : "Некоректна тривалість", "validation", {
      durationMinutes: "Тривалість має бути кратна 15 хвилинам",
    });
  }

  return db.transaction(async (tx) => {
    if (input.masterIds.length > 0) {
      const masters = await tx
        .select({ id: staff.id, role: staff.role, salonId: staff.salonId, status: staff.status })
        .from(staff)
        .where(inArray(staff.id, input.masterIds));

      for (const m of masters) {
        if (m.salonId !== actor.salonId || m.status !== "active") {
          throw new DomainError("Майстер не належить до вашого салону або неактивний", "forbidden");
        }
        if (!canAssignServiceToMaster(actor.role, m.role)) {
          throw new DomainError("Послугу можна призначити лише майстрові", "forbidden");
        }
      }
      if (masters.length !== input.masterIds.length) {
        throw new DomainError("Один із майстрів не знайдений", "validation");
      }
    }

    const [created] = await tx
      .insert(services)
      .values({
        salonId: actor.salonId,
        name: input.name.trim(),
        price: input.price.toFixed(2),
        durationMinutes: input.durationMinutes,
        approval: decision.approval,
        createdByStaffId: actor.staffId,
      })
      .returning({ id: services.id, approval: services.approval });

    if (input.masterIds.length > 0) {
      await tx
        .insert(serviceMasters)
        .values(input.masterIds.map((staffId) => ({ serviceId: created!.id, staffId })));
    }
    return created!;
  });
}

/** Власник затверджує послугу, створену адміністратором. */
export async function approveService(db: DbClient, actor: Actor, serviceId: string) {
  if (!can(actor.role, "service.approve")) {
    throw new DomainError("Затверджувати послуги може лише власник", "forbidden");
  }
  const [updated] = await db
    .update(services)
    .set({ approval: "approved" })
    .where(and(eq(services.id, serviceId), eq(services.salonId, actor.salonId)))
    .returning({ id: services.id });
  if (!updated) throw new DomainError("Послугу не знайдено", "validation");
  return updated;
}

/**
 * Зміна ціни. Власник змінює одразу. Адміністратор створює запит на затвердження
 * (у таблиці price_change_requests), сама ціна лишається чинною.
 */
export async function changeServicePrice(
  db: DbClient,
  actor: Actor,
  serviceId: string,
  newPrice: number,
): Promise<{ action: "applied" | "request_created" }> {
  if (!(newPrice >= 0)) throw new DomainError("Ціна не може бути від'ємною", "validation");

  const decision = decidePriceChange(actor.role);
  if (decision.action === "denied") throw new DomainError(decision.reason, "forbidden");

  return db.transaction(async (tx) => {
    const [service] = await tx
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.salonId, actor.salonId)))
      .limit(1);
    if (!service) throw new DomainError("Послугу не знайдено", "validation");

    if (decision.action === "applied") {
      await tx.update(services).set({ price: newPrice.toFixed(2) }).where(eq(services.id, serviceId));
    } else {
      await tx.insert(priceChangeRequests).values({
        serviceId,
        newPrice: newPrice.toFixed(2),
        requestedByStaffId: actor.staffId,
      });
    }
    return { action: decision.action };
  });
}
