import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import { ui } from "../../../lib/ui";
import { createSalon } from "./actions";

export default async function OnboardingSalonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length > 0) redirect("/app");

  const { error } = await searchParams;

  return (
    <main style={ui.main}>
      <h1>Ваш салон</h1>
      <p style={{ fontSize: "0.9rem" }}>Крок 2 з 2. Пробний період — один місяць.</p>

      {error && <p style={ui.error}>{error}</p>}

      <form action={createSalon} style={ui.form}>
        <label style={ui.label}>
          Назва салону
          <input name="salonName" required style={ui.input} />
        </label>
        <label style={ui.label}>
          Тип бізнесу
          <select name="businessType" required style={ui.input} defaultValue="barber">
            <option value="barber">Перукарня</option>
            <option value="cosmetology">Косметологія</option>
          </select>
        </label>
        <label style={ui.label}>
          Адреса
          <input name="address" style={ui.input} />
        </label>
        <label style={ui.label}>
          Телефон салону
          <input name="phone" type="tel" required placeholder="+380 67 123 45 67" style={ui.input} />
        </label>
        <label style={ui.label}>
          Ваше ім'я
          <input name="displayName" required style={ui.input} />
        </label>
        <label style={ui.label}>
          Електронна пошта
          <input name="email" type="email" defaultValue={session.email ?? ""} required style={ui.input} />
        </label>
        <label style={ui.label}>
          Піддомен (необов'язково)
          <input name="subdomain" placeholder="beauty-lab" style={ui.input} />
          <span style={{ fontSize: "0.8rem", color: "#555" }}>
            Залиште порожнім — створимо з назви салону. Адреса буде виду піддомен.cue.app
          </span>
        </label>
        <button type="submit" style={ui.button}>
          Створити салон
        </button>
      </form>
    </main>
  );
}
