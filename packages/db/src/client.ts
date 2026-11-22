import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Підключення до PostgreSQL (Supabase). Створюється ліниво, щоб імпорт
 * пакета не падав, коли DATABASE_URL ще не задано (наприклад, під час збірки).
 */
let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL не задано");
  }
  const client = postgres(url, { prepare: false, max: 10 });
  cached = drizzle(client, { schema });
  return cached;
}
