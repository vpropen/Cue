import { and, eq } from "drizzle-orm";
import { accounts, salons, staff, subscriptions, type getDb } from "@cue/db";
import { trialEndsAt, validateSubdomain, slugifySalonName } from "@cue/domain";
import { validateSalonRegistrationContact } from "@cue/shared";
import { DomainError } from "./errors";

export type DbClient = ReturnType<typeof getDb>;

export type RegisterSalonInput = {
  /** Ідентифікатор користувача Supabase Auth, який реєструє салон */
  authUserId: string;
  salonName: string;
  businessType: "barber" | "cosmetology";
  phone: string;
  email: string;
  displayName: string;
  /** Якщо не задано — генерується з назви салону */
  subdomain?: string;
  address?: string;
  now?: Date;
};

export type RegisterSalonResult = {
  salonId: string;
  ownerStaffId: string;
  accountId: string;
  subdomain: string;
  trialEndsAt: Date;
};

/**
 * Реєстрація салону власником: салон, особа, співробітник-власник і пробна підписка
 * створюються в одній транзакції. Або все, або нічого.
 */
export async function registerSalon(db: DbClient, input: RegisterSalonInput): Promise<RegisterSalonResult> {
  const now = input.now ?? new Date();

  const contact = validateSalonRegistrationContact({ phone: input.phone, email: input.email });
  if (!contact.ok) {
    throw new DomainError("Перевірте контактні дані", "validation", contact.errors);
  }

  const subdomainCandidate = input.subdomain ?? slugifySalonName(input.salonName);
  const subdomain = validateSubdomain(subdomainCandidate);
  if (!subdomain.ok) {
    throw new DomainError(subdomain.error, "validation", { subdomain: subdomain.error });
  }

  return db.transaction(async (tx) => {
    const taken = await tx
      .select({ id: salons.id })
      .from(salons)
      .where(eq(salons.subdomain, subdomain.value))
      .limit(1);
    if (taken.length > 0) {
      throw new DomainError("Цей піддомен уже зайнятий", "conflict", { subdomain: "Зайнято" });
    }

    // Особа: номер телефону унікальний. Якщо номер уже належить іншому користувачу — конфлікт.
    const [existingByPhone] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.phone, contact.value.phone))
      .limit(1);
    if (existingByPhone && existingByPhone.authUserId && existingByPhone.authUserId !== input.authUserId) {
      throw new DomainError("Цей номер уже використовується іншим обліковим записом", "conflict", {
        phone: "Номер уже зареєстровано",
      });
    }

    let accountId: string;
    if (existingByPhone) {
      accountId = existingByPhone.id;
      await tx
        .update(accounts)
        .set({ authUserId: input.authUserId, email: contact.value.email })
        .where(eq(accounts.id, accountId));
    } else {
      const [created] = await tx
        .insert(accounts)
        .values({
          phone: contact.value.phone,
          email: contact.value.email,
          authUserId: input.authUserId,
          fullName: input.displayName,
        })
        .returning({ id: accounts.id });
      accountId = created!.id;
    }

    const [salon] = await tx
      .insert(salons)
      .values({
        name: input.salonName,
        address: input.address ?? null,
        phone: contact.value.phone,
        businessType: input.businessType,
        subdomain: subdomain.value,
      })
      .returning({ id: salons.id });
    const salonId = salon!.id;

    const [owner] = await tx
      .insert(staff)
      .values({
        salonId,
        accountId,
        role: "owner",
        displayName: input.displayName,
      })
      .returning({ id: staff.id });

    const endsAt = trialEndsAt(now);
    await tx.insert(subscriptions).values({
      salonId,
      plan: "trial",
      status: "trial",
      trialEndsAt: endsAt,
    });

    return {
      salonId,
      ownerStaffId: owner!.id,
      accountId,
      subdomain: subdomain.value,
      trialEndsAt: endsAt,
    };
  });
}

/** Хелпер для тестів і пошуку: співробітник-власник салону. */
export async function findOwner(db: DbClient, salonId: string) {
  const [row] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.salonId, salonId), eq(staff.role, "owner")))
    .limit(1);
  return row ?? null;
}
