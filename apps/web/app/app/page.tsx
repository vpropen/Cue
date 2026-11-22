import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { ui } from "../../lib/ui";

const ROLE_LABEL = { owner: "Власник", admin: "Адміністратор", master: "Майстер" } as const;

export default async function AppHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length === 0) redirect("/onboarding/salon");

  return (
    <main style={ui.main}>
      <h1>Cue</h1>
      <p style={{ fontSize: "0.9rem" }}>Вітаємо{session.email ? `, ${session.email}` : ""}.</p>

      <ul style={{ paddingLeft: "1rem" }}>
        {session.memberships.map((m) => (
          <li key={m.staffId} style={{ marginBottom: "0.5rem" }}>
            <strong>{m.salonName}</strong> — {ROLE_LABEL[m.role]}
            <div style={{ fontSize: "0.8rem", color: "#555" }}>{m.subdomain}.cue.app</div>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: "0.85rem", color: "#555" }}>
        Календар, записи і графік з&apos;являться на наступних етапах.
      </p>

      <form action="/auth/signout" method="post">
        <button type="submit" style={ui.secondaryButton}>
          Вийти
        </button>
      </form>
    </main>
  );
}
