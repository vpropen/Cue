"use server";

import { redirect } from "next/navigation";
import { DomainError, registerSalon } from "@cue/core";
import { getDb } from "@cue/db";
import { getSession } from "../../../lib/session";

/** Крок 2 реєстрації: створення салону власником, який уже увійшов. */
export async function createSalon(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length > 0) redirect("/app");

  const businessType = String(formData.get("businessType") ?? "");
  if (businessType !== "barber" && businessType !== "cosmetology") {
    redirect(`/onboarding/salon?error=${encodeURIComponent("Оберіть тип бізнесу")}`);
  }

  const subdomain = String(formData.get("subdomain") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  try {
    await registerSalon(getDb(), {
      authUserId: session.userId,
      salonName: String(formData.get("salonName") ?? "").trim(),
      businessType,
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? session.email ?? ""),
      displayName: String(formData.get("displayName") ?? "").trim(),
      subdomain: subdomain || undefined,
      address: address || undefined,
    });
  } catch (err) {
    if (err instanceof DomainError) {
      const message = Object.values(err.fields ?? {})[0] ?? err.message;
      redirect(`/onboarding/salon?error=${encodeURIComponent(message)}`);
    }
    throw err;
  }

  redirect("/app");
}
