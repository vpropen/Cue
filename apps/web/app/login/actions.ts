"use server";

import { redirect } from "next/navigation";
import { appUrl, createSupabaseServerClient } from "../../lib/supabase";
import { translateAuthError } from "../../lib/ui";

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }
  redirect("/app");
}

/** Вхід через Google або Facebook (Meta). Supabase повертає адресу провайдера. */
export async function loginWithOAuth(formData: FormData) {
  const provider = String(formData.get("provider"));
  if (provider !== "google" && provider !== "facebook") {
    redirect("/login?error=" + encodeURIComponent("Невідомий спосіб входу"));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${appUrl()}/auth/callback` },
  });
  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Не вдалося відкрити вхід через провайдера")}`);
  }
  redirect(data.url);
}
