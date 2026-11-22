/**
 * Ролі і права співробітників салону за специфікацією.
 * Ця таблиця — єдине джерело правди для рішень «можна / не можна» в застосунку.
 * Ті самі правила дублюються в RLS (див. migrations/0004_rls_scope.sql) як другий рівень захисту.
 */

export type StaffRole = "owner" | "admin" | "master";

export const PERMISSIONS = [
  "salon.settings.edit",
  "staff.create_admin",
  "staff.create_master",
  "service.create",
  "service.approve",
  "price.edit",
  "price.request",
  "schedule.salon.edit",
  "schedule.own.view",
  "time_off.manage",
  "stats.view_all",
  "booking.manage_all",
  "booking.manage_own",
  "client.view_all",
  "client.view_own",
  "client.notes_edit_own",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER_ONLY: readonly Permission[] = [
  "staff.create_admin",
  "price.edit",
  "service.approve",
  "salon.settings.edit",
];

const ADMIN: readonly Permission[] = [
  "staff.create_master",
  "service.create",
  "price.request",
  "schedule.salon.edit",
  "time_off.manage",
  "stats.view_all",
  "booking.manage_all",
  "client.view_all",
  "booking.manage_own",
  "client.view_own",
  "client.notes_edit_own",
  "schedule.own.view",
];

const MASTER: readonly Permission[] = [
  "booking.manage_own",
  "schedule.own.view",
  "client.view_own",
  "client.notes_edit_own",
];

const MATRIX: Record<StaffRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([...OWNER_ONLY, ...ADMIN, ...MASTER, "service.create"]),
  admin: new Set<Permission>(ADMIN),
  master: new Set<Permission>(MASTER),
};

export function can(role: StaffRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}
