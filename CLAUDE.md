# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity
RadioStack is a Next.js 16 (App Router) radio-directory + persistent-player single-page app. The one canonical data-layer fact: **the only live datastore is Cloud Firestore** — accessed via `firebase-admin` in API routes and the `firebase` web SDK on the client. There is no Prisma and no PostgreSQL; the `supabase/` folder, `*.sql` files, and `DATABASE_URL` are dead leftovers.

## Commands
```bash
npm run dev       # next dev --turbopack (http://localhost:3000)
npm run build     # next build
npm run start     # next start
npm run lint      # eslint
npm run analyze   # ANALYZE=true next build (bundle analyzer)
```
Correctness gates: `npm run build` (type-check + compile) and `npm run lint` must pass. There is **no test suite** and **no** database/seed npm script — do not invent `prisma db push`, `prisma db seed`, or migrations. Sample data lives in `stations.json` / `stations.m3u` (`generate-seed.mjs` regenerates it); real data is created via the admin panel's M3U import.

## Architecture

### Data flow
1. Client interaction (station click, admin mutation) in a `'use client'` component.
2. State updates: Zustand player store (`player-store.ts`) for playback; local React state for admin lists — admin mutations update **optimistically** and roll back on failure.
3. `fetch('/api/...')`, sending `Authorization: Bearer <firebaseIdToken>` for protected routes.
4. Route handler in `src/app/api/**/route.ts` reads/writes Firestore via `getDb()` (Admin SDK), filtering `deletedAt` as needed, and returns docs mapped through `serializeDoc()`.
5. Sonner toast reports success/failure.

### Directory layout
```
src/
  app/
    layout.tsx           # root: fonts, Toaster, SpeedInsights (NOT the player)
    page.tsx             # single page: StationBrowser + PlayerBar + AdminPanel modal
    globals.css
    api/
      stations/route.ts                 # GET active (public) / POST create (admin)
      stations/[id]/route.ts            # PATCH update / DELETE soft-delete (admin)
      stations/[id]/restore/route.ts    # POST restore (admin)
      stations/trash/route.ts           # GET list / DELETE hard-purge (admin)
      stations/offline/route.ts         # GET isLive==false (admin)
      categories/route.ts               # GET distinct categories (public)
      categories/[name]/route.ts        # DELETE soft-delete category (admin)
      categories/[name]/restore/route.ts# POST restore category (admin)
      import/route.ts                   # POST M3U import (admin, rate-limited)
      metadata/route.ts                 # GET ICY stream metadata proxy (public)
      users/[uid]/approve/route.ts      # POST approve user (admin)
  components/
    station-browser.tsx  # list/search/filter + admin bulk-select actions
    station-card.tsx      # card, selection checkbox, logo upload, scroll anchor
    admin-panel.tsx       # Settings modal: import/export/offline/trash/pending
    player-bar.tsx        # bottom player, Media Session, equalizer, metadata poll
    auth-modal.tsx        # user sign-in / sign-up
  stores/
    player-store.ts       # Zustand: playback state (see Key patterns)
    auth-store.ts         # Zustand: Firebase auth + approval status
  hooks/
    use-favorites.ts      # favorites in Firestore users/{uid}.favorites
  lib/
    firebase.ts           # Admin SDK: getDb, getAdminAuth, serializeDoc
    firebase-client.ts    # web SDK: auth, db, storage
    auth.ts               # verifyAuth(req): validate Bearer ID token
    rate-limit.ts         # in-memory Map rate limiter
    utils.ts              # cn()
  types/
    station.ts            # Station interface (plain type, no ORM model)
```

### Key patterns
- **Soft delete**: a `deletedAt` timestamp on the Firestore station doc. `null` = active, non-null = trashed. Active reads filter `where('deletedAt', '==', null)`; the Trash tab uses `where('deletedAt', '!=', null)`; restore sets it back to `null`. The **only** hard delete in the app is `DELETE /api/stations/trash` (`batch.delete` of already-trashed docs).
- **Rate limiting**: only `POST /api/import` — 3 requests / 60s / IP via the in-memory limiter in `lib/rate-limit.ts` (per-process, not shared across instances).
- **Persistent player**: `PlayerBar` is rendered by `page.tsx` (not `layout.tsx`) and never unmounts; the admin panel is a modal overlay, so audio keeps playing. Player state is in the Zustand store and is **not** persisted across reloads.
- **Favorites**: stored in Firestore at `users/{uid}.favorites` (array), synced with `onSnapshot` — not localStorage, not the player store.
- **Auth**: admin routes call `verifyAuth(req)` then require `decoded.email === 'admin@radiostack.com'`. Non-admin users need approval (custom claim + `users` doc), granted from the Pending tab.

## Absolute rules — do not break these
1. **Firestore is the only data layer.** Never add Prisma/SQL or reference the dead `supabase/`, `*.sql`, or `DATABASE_URL` artifacts.
2. **Never hard-delete a station** except through `DELETE /api/stations/trash`. All other deletes set `deletedAt` (soft delete).
3. **Always filter `deletedAt == null`** in user-facing / active-station reads; the Trash view is the only place that reads non-null `deletedAt`.
4. **Guard every admin route** with `verifyAuth(req)` AND `decoded.email === 'admin@radiostack.com'`. Protected fetches must send `Authorization: Bearer <idToken>`.
5. **Playback state lives in `src/stores/player-store.ts`** (Zustand). Do not add favorites to it — favorites belong in Firestore via `src/hooks/use-favorites.ts`.
6. **Keep `PlayerBar` mounted in `page.tsx`.** Do not move it into `layout.tsx` or gate it behind route changes; the app is single-page and relies on the player staying mounted under the modal.
7. **API routes follow `src/app/api/**/route.ts`** conventions and map Firestore docs through `serializeDoc()` before returning them.

## Doc trust note
After this correction, `README.md`, `architecture.md`, and this file reflect the actual Firebase/Firestore code. Trust them over any in-repo mention of Prisma/PostgreSQL/Supabase and over `.env.example` (which still lists a stale `DATABASE_URL`) — those are dead artifacts.
