import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase";

/**
 * Повернення після підтвердження пошти або входу через OAuth.
 * Обмінює code на сесію, далі — в застосунок (там вирішиться, чи потрібен салон).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Посилання застаріло або пошкоджене")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Не вдалося підтвердити вхід")}`);
  }
  return NextResponse.redirect(`${origin}/app`);
}
