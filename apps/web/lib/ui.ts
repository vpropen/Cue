/** Мінімальні стилі для сторінок входу і реєстрації (до підключення Tailwind). */
export const ui = {
  main: {
    maxWidth: 420,
    margin: "3rem auto",
    padding: "0 1rem",
    fontFamily: "system-ui, sans-serif",
    color: "#1a1a1a",
  },
  form: { display: "grid", gap: "0.75rem", marginTop: "1rem" },
  label: { display: "grid", gap: "0.25rem", fontSize: "0.9rem" },
  input: {
    padding: "0.6rem 0.7rem",
    border: "1px solid #bbb",
    borderRadius: 6,
    fontSize: "1rem",
  },
  button: {
    padding: "0.7rem",
    border: 0,
    borderRadius: 6,
    background: "#1a1a1a",
    color: "#fff",
    fontSize: "1rem",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "0.7rem",
    border: "1px solid #1a1a1a",
    borderRadius: 6,
    background: "#fff",
    color: "#1a1a1a",
    fontSize: "1rem",
    cursor: "pointer",
  },
  error: { color: "#b00020", fontSize: "0.9rem" },
  notice: { color: "#1b5e20", fontSize: "0.9rem" },
  link: { color: "#1a1a1a" },
} as const;

/** Переклад типових повідомлень Supabase Auth українською. */
export function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Невірна електронна пошта або пароль",
    "User already registered": "Обліковий запис із цією поштою вже існує",
    "Email not confirmed": "Підтвердіть електронну пошту за посиланням з листа",
    "Password should be at least 6 characters.": "Пароль має бути не коротший за 8 символів",
  };
  return map[message] ?? "Не вдалося виконати дію. Спробуйте ще раз";
}
