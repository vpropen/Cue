"use server";

import { redirect } from "next/navigation";
import { isValidEmail } from "@cue/shared";
import { createSupabaseServerClient, appUrl } from "../../lib/supabase";
import { translateAuthError } from "../../lib/ui";

const MIN_PASSWORD_LENGTH = 8;

function fail(message: string): never {
  redirect(`/register?error=${encodeURIComponent(message)}`);
}

/**
 * Крок 1 реєстрації: обліковий запис власника (пошта і пароль).
 * Крок 2 — дані салону на /onboarding/salon. Тут салон ще не створюється.
 */
export async function registerAccount(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!isValidEmail(email)) fail("Некоректна електронна пошта");
  if (password.length < MIN_PASSWORD_LENGTH) fail(`Пароль має бути не коротший за ${MIN_PASSWORD_LENGTH} символів`);
  if (!displayName) fail("Вкажіть ваше ім'я");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback`,
      data: { full_name: displayName },
    },
  });
  if (error) fail(translateAuthError(error.message));

  // Якщо підтвердження пошти вимкнене, сесія вже є — одразу до салону.
  if (data.session) redirect("/onboarding/salon");

  redirect(
    "/login?message=" +
      encodeURIComponent("Ми надіслали лист. Підтвердіть пошту за посиланням і увійдіть"),
  );
}
