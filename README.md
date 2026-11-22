# Cue

SaaS-календар записів для салонів краси (перукарні, косметологи). Старт в Україні.

Повна специфікація, рішення і відкриті питання: [docs/decisions.md](docs/decisions.md).

## Структура

```
apps/web                 Next.js (App Router, TypeScript): кабінет, публічний запис, API
packages/db              Drizzle ORM: схема і міграції PostgreSQL (Supabase)
packages/availability    Розрахунок вільних слотів (спільний для кабінету і бота)
docs/decisions.md        Рішення за замовчуванням і відкриті питання
```

## Вимоги

- Node.js 20.9 або новіший
- pnpm 10 (`corepack enable`)

## Запуск

```bash
pnpm install
cp .env.example .env        # заповнити значення
pnpm dev                    # http://localhost:3000
```

## Команди

| Команда | Що робить |
|---|---|
| `pnpm dev` | Запускає веб-застосунок |
| `pnpm build` | Збирає всі пакети |
| `pnpm typecheck` | Перевіряє типи |
| `pnpm test` | Запускає тести (зараз `@cue/availability`) |
| `pnpm db:generate` | Генерує міграцію зі змін у `schema.ts` |
| `pnpm db:migrate` | Застосовує міграції до `DATABASE_URL` |

Ручні міграції (наприклад, EXCLUDE-обмеження) створюються так:
`pnpm --filter @cue/db drizzle-kit generate --custom --name=<назва>`.
