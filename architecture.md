# RadioStack Architecture Guide for Agents

This document provides a technical overview of the RadioStack project to help AI agents understand the codebase and maintain consistency. Every statement below is verified against the source in `src/`.

## Overview
RadioStack is a web-based radio streaming application built with the Next.js App Router. It features a station browser, a persistent bottom player, and an administrative modal for content management. It is a **single-page** app: `src/app/page.tsx` renders the browser, the player, and (conditionally) the admin panel — there is no separate `/admin` route.

## Core Technology Stack
- **Next.js 16 (App Router, Turbopack in dev)**: React 19 features.
- **Cloud Firestore**: the only live datastore. Accessed via `firebase-admin` on the server (API routes) and the `firebase` web SDK on the client (auth-store, favorites, pending-users listener).
- **Firebase Authentication**: email/password, with an approval flow built on custom claims + a Firestore `users` doc.
- **Firebase Storage**: station logo uploads (`station-logos/…`).
- **Zustand**: global state for the player only (`player-store.ts`).
- **Tailwind CSS 4**: utility-first styling.
- **Sonner**: toast notifications.

> There is **no Prisma and no PostgreSQL** in the running app. The `supabase/` directory, `check.sql` / `verify.sql`, the `supabase/migrations/*.sql` file, and `DATABASE_URL` in `.env.example` are dead artifacts from a prior design. Ignore them.

## Project Structure

### `/src/app`
- **`/api`**: Backend route handlers (see API surface below).
- **`layout.tsx`**: Root layout — fonts, `<Toaster>`, `SpeedInsights`. (The player is **not** here; it lives in `page.tsx`.)
- **`page.tsx`**: The single page — renders `StationBrowser`, `PlayerBar`, and the `AdminPanel` modal. Calls `useAuthStore().init()` on mount.

### `/src/components`
- **`station-browser.tsx`**: Fetches stations/categories, handles search + highlighting, category filtering, favorites view, and **admin bulk actions** (multi-select → bulk delete / move-to-category via an action bar). Station create/edit UI also lives here.
- **`station-card.tsx`**: Individual station item; selection checkbox (admin), logo upload to Firebase Storage, search-term highlighting, and `id="station-{id}"` for scroll-to-active.
- **`admin-panel.tsx`**: The Settings modal. Admin login, and tabs: Import, Export, Offline, Trash, Pending (user approvals). Owns the optimistic trash/restore/offline flows.
- **`player-bar.tsx`**: Sticky bottom player. Reads the Zustand store, drives an `<audio>` element, Media Session API, ICY metadata polling, a Web Audio equalizer canvas, the queue drop-up, and favorites toggle.
- **`auth-modal.tsx`**: Sign-in / sign-up for regular users.

### `/src/stores`
- **`player-store.ts`**: Zustand store. Fields: `currentStation`, `currentCategoryStations` (the "queue"/up-next list), `isPlaying`, `shuffle`, `volume`, `streamError`. Actions: `setStation`, `next`, `prev`, `togglePlay`, `toggleShuffle`, `setVolume`, `setStreamError`. **No persistence middleware** and **no** `favorites` field here.
- **`auth-store.ts`**: Zustand store wrapping Firebase Auth. Tracks `user`, `isAdmin` (email === `admin@radiostack.com`), `pendingApproval`, and `idToken`. Subscribes to the user's Firestore doc for approval status.

### `/src/hooks`
- **`use-favorites.ts`**: Favorites live in Firestore at `users/{uid}.favorites` (an array). The hook listens via `onSnapshot` and toggles with `arrayUnion` / `arrayRemove`. **Not** localStorage, **not** the Zustand store.

### `/src/lib`
- **`firebase.ts`**: Server-side Admin SDK init (`getDb()` → Firestore, `getAdminAuth()`), plus `serializeDoc()` which maps a Firestore doc to a `Station` and converts Timestamps to ISO strings.
- **`firebase-client.ts`**: Client web-SDK init (`auth`, `db`, `storage`).
- **`auth.ts`**: `verifyAuth(req)` — validates the `Authorization: Bearer <idToken>` header via the Admin SDK.
- **`rate-limit.ts`**: In-memory (`Map`-based) fixed-window rate limiter.
- **`utils.ts`**: `cn()` class-name helper.

### `/src/types`
- **`station.ts`**: The `Station` shape — `id`, `name`, `streamUrl`, `logo?`, `category?`, `isLive`, `deletedAt?`, `createdAt?`, `updatedAt?`. This is a plain interface; there is no ORM model/schema file.

## API Surface (`src/app/api`)
- **`GET /api/stations`** — public. Returns active stations (`deletedAt == null && isLive == true`), optional `?category=`.
- **`POST /api/stations`** — admin. Creates a station (rejects duplicate `streamUrl`).
- **`PATCH /api/stations/[id]`** — admin. Updates `name` / `category` / `isLive`. Refuses if already soft-deleted.
- **`DELETE /api/stations/[id]`** — admin. **Soft delete**: sets `deletedAt = now`.
- **`POST /api/stations/[id]/restore`** — admin. Clears `deletedAt`.
- **`GET /api/stations/trash`** — admin. Lists `deletedAt != null`.
- **`DELETE /api/stations/trash`** — admin. **Hard purge** of all trashed docs via `batch.delete` (the only hard delete in the app).
- **`GET /api/stations/offline`** — admin. Lists `isLive == false` (and `deletedAt == null`).
- **`GET /api/categories`** — public. Distinct category names among active stations.
- **`DELETE /api/categories/[name]`** — admin. Soft-deletes every active station in the category.
- **`POST /api/categories/[name]/restore`** — admin. Restores a soft-deleted category.
- **`POST /api/import`** — admin, **rate-limited (3 / 60s / IP)**. Parses M3U text, upserts by `streamUrl`.
- **`GET /api/metadata?url=`** — public. Proxies/parses ICY stream metadata (`StreamTitle`).
- **`POST /api/users/[uid]/approve`** — admin. Sets a `approved` custom claim and updates the Firestore `users` doc.

## Key Implementation Patterns

### 1. Soft Deletes (Firestore)
Deletion is a `deletedAt` timestamp on the station document, not a row removal.
- User-facing / active queries filter `where('deletedAt', '==', null)`.
- The Trash tab queries `where('deletedAt', '!=', null)`.
- Restoring sets `deletedAt` back to `null`.
- The **only** true hard delete is `DELETE /api/stations/trash` (batch delete of already-trashed docs).

### 2. Optimistic UI (with rollback)
In `admin-panel.tsx`, trash/restore/offline/empty operations snapshot the relevant local state, apply the change immediately, fire the API call, and **roll back to the snapshot on failure** (surfacing a Sonner error). Bulk delete / bulk move in `station-browser.tsx` follow the same optimistic pattern. Note: station **creation** and **M3U import** are not optimistic — they refetch on success.

### 3. Rate Limiting
Only `/api/import` is rate-limited — 3 requests per 60 seconds per client IP, via the in-memory limiter in `src/lib/rate-limit.ts`. The limiter state is per-process (not shared across serverless instances).

### 4. Auth & Authorization
- The client obtains a Firebase ID token; admin-only API routes call `verifyAuth(req)` and additionally require `decoded.email === 'admin@radiostack.com'`.
- Regular users must be approved: `auth-store` and `use-favorites` react to the Firestore `users/{uid}` doc; approval is granted from the Pending tab.

### 5. Persistence & Player Continuity
- **Favorites**: Firestore (`users/{uid}.favorites`), synced live via `onSnapshot`.
- **Player state**: held in the Zustand store; it is **not** persisted to storage (reloading resets it). The player keeps playing while the admin panel is open because the panel is a modal overlay in the same page — `PlayerBar` never unmounts. There is no client-side routing.

## Data Flow
1. **Client Interaction**: user clicks a station or an admin action.
2. **State Update**: Zustand (player) or local component state updates — optimistically for admin mutations.
3. **API Call**: `fetch()` to `/api/...`, with `Authorization: Bearer <idToken>` for protected routes.
4. **Firestore**: the route handler reads/writes via the Admin SDK (`getDb()`), filtering `deletedAt` as appropriate.
5. **Feedback**: Sonner toast reports success/failure; failed optimistic mutations roll back.

## Guidance for AI Agents
- **Data layer**: Firestore only. Never reintroduce Prisma/SQL or reference the dead `supabase/` artifacts.
- **Deletes**: never hard-delete a station except through the dedicated trash-purge route; use the `deletedAt` soft-delete everywhere else, and always filter `deletedAt == null` in user-facing reads.
- **Admin gate**: protected routes must call `verifyAuth` and check `email === 'admin@radiostack.com'`.
- **State**: use `player-store.ts` for playback/global-station concerns; favorites belong in Firestore via `use-favorites`, not the store.
- **API Routes**: follow the existing `src/app/api/**/route.ts` structure and the serialize-via-`serializeDoc` convention.
- **Styling**: follow the Tailwind 4 patterns and the neon-yellow (`#e8ff00`) accent.
