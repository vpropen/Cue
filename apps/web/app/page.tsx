import Link from "next/link";
import { ui } from "../lib/ui";

export default function HomePage() {
  return (
    <main style={ui.main}>
      <h1>Cue</h1>
      <p>Календар записів для салонів краси.</p>
      <p style={{ display: "flex", gap: "1rem" }}>
        <Link href="/login" style={ui.link}>Увійти</Link>
        <Link href="/register" style={ui.link}>Зареєструвати салон</Link>
      </p>
    </main>
  );
}
