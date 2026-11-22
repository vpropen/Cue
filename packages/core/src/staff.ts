import { and, eq } from "drizzle-orm";
import { staff } from "@cue/db";
import { canAddStaff, can, type StaffRole } from "@cue/domain";
import { DomainError } from "./errors";
import type { DbClient } from "./register-salon";

export type Actor = { staffId: string; salonId: string; role: StaffRole };

export type AddStaffInput = {
  role: "admin" | "master";
  displayName: string;
  /** Максимум співробітників на тарифі; за замовчуванням 10 */
  maxStaff?: number;
};

/**
 * Додає співробітника. Адміністратора створює лише власник. Майстра — власник або адміністратор.
 * Новий співробітник отримує запрошення в Telegram і сам задає пароль (окремий флоу).
 */
export async function addStaff(db: DbClient, actor: Actor, input: AddStaffInput) {
  const permission = input.role === "admin" ? "staff.create_admin" : "staff.create_master";
  if (!can(actor.role, permission)) {
    throw new DomainError("Недостатньо прав для створення цієї ролі", "forbidden");
  }
  if (!input.displayName.trim()) {
    throw new DomainError("Вкажіть ім'я співробітника", "validation", { displayName: "Обов'язкове поле" });
  }

  return db.transaction(async (tx) => {
    // Лічимо активних співробітників салону в тій самій транзакції (без гонки на ліміті)
    const active = await tx
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.salonId, actor.salonId), eq(staff.status, "active")));

    if (!canAddStaff(active.length, input.maxStaff)) {
      throw new DomainError("Досягнуто ліміт співробітників за тарифом", "limit_reached");
    }

    const [created] = await tx
      .insert(staff)
      .values({
        salonId: actor.salonId,
        role: input.role,
        displayName: input.displayName.trim(),
      })
      .returning({ id: staff.id, role: staff.role });
    return created!;
  });
}

/** Активні майстри салону (для вибору при призначенні послуг). */
export async function listActiveMasters(db: DbClient, salonId: string) {
  return db
    .select({ id: staff.id, displayName: staff.displayName })
    .from(staff)
    .where(and(eq(staff.salonId, salonId), eq(staff.role, "master"), eq(staff.status, "active")));
}
