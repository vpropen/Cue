/**
 * Правила послуг, цін і призначення майстрів.
 */
import type { StaffRole } from "./roles";
import { can } from "./roles";

export type CreateServiceDecision =
  | { allowed: true; approval: "approved" | "pending_owner_approval" }
  | { allowed: false; reason: string };

/**
 * Власник створює послугу одразу. Адміністратор створює, але її бачить власник
 * і має підтвердити. Майстер послуги не створює.
 */
export function decideServiceCreation(role: StaffRole): CreateServiceDecision {
  if (role === "owner") return { allowed: true, approval: "approved" };
  if (role === "admin") return { allowed: true, approval: "pending_owner_approval" };
  return { allowed: false, reason: "Майстер не може створювати послуги" };
}

export type PriceChangeDecision =
  | { action: "applied" }
  | { action: "request_created" }
  | { action: "denied"; reason: string };

/** Ціну змінює власник. Адміністратор лише надсилає запит. */
export function decidePriceChange(role: StaffRole): PriceChangeDecision {
  if (can(role, "price.edit")) return { action: "applied" };
  if (can(role, "price.request")) return { action: "request_created" };
  return { action: "denied", reason: "Недостатньо прав для зміни ціни" };
}

/**
 * Призначати послуги майстрам може власник і адміністратор.
 * Призначати можна лише майстрам (роль master), не адміністраторам.
 */
export function canAssignServiceToMaster(actorRole: StaffRole, targetRole: StaffRole): boolean {
  return targetRole === "master" && (actorRole === "owner" || actorRole === "admin");
}

export type ServiceBookability = {
  status: "active" | "disabled";
  approval: "approved" | "pending_owner_approval";
  /** Кількість майстрів, які можуть виконувати послугу і є активними */
  activeMasters: number;
};

/**
 * Послуга з'являється в календарі для вибору лише якщо вона активна, підтверджена
 * і має хоча б одного майстра. Майстер без жодної послуги не відображається у виборі.
 */
export function isServiceBookable(s: ServiceBookability): boolean {
  return s.status === "active" && s.approval === "approved" && s.activeMasters > 0;
}

/** Майстер відображається у виборі, лише якщо має хоча б одну призначену послугу. */
export function isMasterSelectable(assignedServiceCount: number): boolean {
  return assignedServiceCount > 0;
}
