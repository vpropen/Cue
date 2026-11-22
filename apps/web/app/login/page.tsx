import Link from "next/link";
import { loginWithOAuth, loginWithPassword } from "./actions";
import { ui } from "../../lib/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main style={ui.main}>
      <h1>Вхід</h1>

      {error && <p style={ui.error}>{error}</p>}
      {message && <p style={ui.notice}>{message}</p>}

      <form action={loginWithPassword} style={ui.form}>
        <label style={ui.label}>
          Електронна пошта
          <input name="email" type="email" required autoComplete="email" style={ui.input} />
        </label>
        <label style={ui.label}>
          Пароль
          <input name="password" type="password" required autoComplete="current-password" style={ui.input} />
        </label>
        <button type="submit" style={ui.button}>
          Увійти
        </button>
      </form>

      <h2 style={{ fontSize: "1rem", marginTop: "2rem" }}>Або увійти через</h2>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <form action={loginWithOAuth}>
          <input type="hidden" name="provider" value="google" />
          <button type="submit" style={{ ...ui.secondaryButton, width: "100%" }}>
            Google
          </button>
        </form>
        <form action={loginWithOAuth}>
          <input type="hidden" name="provider" value="facebook" />
          <button type="submit" style={{ ...ui.secondaryButton, width: "100%" }}>
            Facebook
          </button>
        </form>
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.9rem" }}>
        Ще немає салону? <Link href="/register" style={ui.link}>Зареєструватися</Link>
      </p>
    </main>
  );
}
