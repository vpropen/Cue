import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задано змінну середовища ${name}`);
  return value;
}

/** Клієнт Supabase для серверного коду (Server Components, дії, route handlers). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // У Server Components куки не можна писати; оновлення сесії робить middleware.
          }
        },
      },
    },
  );
}

/** Повна адреса застосунку, потрібна для посилань у листах і OAuth-редіректів. */
export function appUrl(): string {
  return requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
}
