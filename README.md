# RadioStack

Turkish and international radio streams in one place — **Next.js**, **Prisma** (SQLite), **M3U import**, categories, favorites, soft delete, and an admin panel.

## Features

- Browse stations by category, **All**, or **Favorites** (`localStorage` key: `radyo_favorites`)
- Sticky player with **previous / next** (wrap-around within the current list)
- Per-station menu: rename, change category, soft delete — optimistic UI + toasts (**Sonner**)
- Admin: **Stations** (with category-wide soft delete), **M3U import** (rate-limited), **Trash** (restore / empty trash)
- Seed script loads `prisma/stations.json` and normalizes tiny categories post-seed

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Git](https://git-scm.com/)

## Setup

```bash
git clone https://github.com/waldseelen/RadioStack.git
cd RadioStack
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin UI: `/admin`.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Production server |
| `npm run db:push` | Push Prisma schema to SQLite |
| `npm run db:seed` | Run `ts-node prisma/seed.ts` (via Prisma seed) |
| `npm run db:studio` | Prisma Studio |

## Environment

```bash
cp .env.example .env
```

Or create `.env` with:

```env
DATABASE_URL="file:./dev.db"
```

SQLite file is created under `prisma/` after `db push`.

## Tech stack

Next.js 15.3.6+ (patched for [CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478)) · React 19 · Prisma 6 · SQLite · Tailwind CSS 4 · Zustand · lucide-react · Sonner

## License

MIT (or your choice — add a `LICENSE` file if needed).
