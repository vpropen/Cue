import { and, eq } from "drizzle-orm";
import { accounts, getDb, salons, staff } from "@cue/db";
import { createSupabaseServerClient } from "./supabase";

export type Membership = {
  staffId: string;
  salonId: string;
  salonName: string;
  subdomain: string;
  role: "owner" | "admin" | "master";
};

export type Session = {
  userId: string;
  email: string | null;
  memberships: Membership[];
};

/**
 * Поточний користувач і його активні місця в салонах.
 * Повертає null, якщо користувач не увійшов.
 *
 * Запит іде через сервер з прямим підключенням до БД, тому фільтр за authUserId
 * тут обов'язковий: без нього користувач побачив би чужі салони.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await getDb()
    .select({
      staffId: staff.id,
      salonId: salons.id,
      salonName: salons.name,
      subdomain: salons.subdomain,
      role: staff.role,
    })
    .from(staff)
    .innerJoin(accounts, eq(accounts.id, staff.accountId))
    .innerJoin(salons, eq(salons.id, staff.salonId))
    .where(and(eq(accounts.authUserId, user.id), eq(staff.status, "active")));

  return { userId: user.id, email: user.email ?? null, memberships: rows };
}
