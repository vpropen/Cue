import Link from "next/link";
import { registerAccount } from "./actions";
import { ui } from "../../lib/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={ui.main}>
      <h1>Реєстрація власника</h1>
      <p style={{ fontSize: "0.9rem" }}>
        Крок 1 з 2. Далі вкажете дані салону.
      </p>

      {error && <p style={ui.error}>{error}</p>}

      <form action={registerAccount} style={ui.form}>
        <label style={ui.label}>
          Ваше ім'я
          <input name="displayName" required autoComplete="name" style={ui.input} />
        </label>
        <label style={ui.label}>
          Електронна пошта
          <input name="email" type="email" required autoComplete="email" style={ui.input} />
        </label>
        <label style={ui.label}>
          Пароль (від 8 символів)
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={ui.input}
          />
        </label>
        <button type="submit" style={ui.button}>
          Продовжити
        </button>
      </form>

      <p style={{ marginTop: "2rem", fontSize: "0.9rem" }}>
        Уже маєте обліковий запис? <Link href="/login" style={ui.link}>Увійти</Link>
      </p>
    </main>
  );
}
