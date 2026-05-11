# RadioStack Architecture Guide for Agents

This document provides a technical overview of the RadioStack project to help AI agents understand the codebase and maintain consistency.

## Overview
RadioStack is a web-based radio streaming application built with the Next.js App Router. It features a station browser, a persistent player, and an administrative interface for content management.

## Core Technology Stack
- **Next.js 15 (Turbopack)**: App Router, React 19 features.
- **Prisma 6**: ORM for PostgreSQL (Supabase).
- **Zustand**: Global state management for the player and active station.
- **Tailwind CSS 4**: Utility-first styling.
- **Sonner**: Toast notifications for feedback.

## Project Structure

### `/src/app`
- **`/api`**: Backend endpoints for station management, categories, and M3U import.
- **`/admin`**: The administrative interface route.
- **`layout.tsx`**: Contains the `PlayerBar` to ensure persistence across navigations.
- **`page.tsx`**: The main station browser.

### `/src/components`
- **`admin-panel.tsx`**: Large client component handling stations, import, and trash.
- **`station-browser.tsx`**: Handles filtering, search, and category selection.
- **`station-card.tsx`**: Individual station item with controls.
- **`player-bar.tsx`**: Sticky player UI interacting with the Zustand store.

### `/src/stores`
- **`player-store.ts`**: Zustand store managing `activeStation`, `isPlaying`, `queue`, and `favorites`.

### `/src/lib`
- **`prisma.ts`**: Singleton Prisma client.
- **`rate-limit.ts`**: Simple memory-based rate limiting for sensitive operations (e.g., M3U import).

### `/prisma`
- **`schema.prisma`**: Defines the `Station` model with soft-delete support (`deletedAt`).
- **`seed.ts`**: Populates the database with initial station data.

## Key Implementation Patterns

### 1. Soft Deletes
The system uses a `deletedAt` field in the `Station` model. 
- Regular queries should filter for `deletedAt: null`.
- The **Trash** tab in the admin panel queries for `deletedAt: { not: null }`.

### 2. Optimistic UI
Admin actions (like renaming or deleting stations) update the local React state before the API call finishes to provide an instantaneous feel. If the call fails, the state is rolled back.

### 3. Rate Limiting
The M3U import feature is rate-limited on the server side to prevent abuse, allowing only 3 requests per 60 seconds per IP.

### 4. Persistence
- **Favorites**: Stored in `localStorage` via the Zustand store's middleware or manual sync.
- **Active Station**: Managed by the Zustand store but persists during navigation because the `PlayerBar` is in the root layout.

## Data Flow
1. **Client Interaction**: User clicks a station or admin action.
2. **State Update**: Zustand store or local component state updates (Optimistic).
3. **API Call**: `fetch()` request to `/api/...`.
4. **Prisma/DB**: Server-side route handler performs DB operations.
5. **Feedback**: Toast notification (Sonner) informs the user of success or failure.

## Guidance for AI Agents
- **Adding Features**: Ensure new UI components follow the Tailwind 4 patterns.
- **Database Changes**: Always update `schema.prisma` and run `npx prisma generate`.
- **API Routes**: Follow the existing structure in `src/app/api` using standard Next.js `route.ts` patterns.
- **State**: Use the `playerStore` for anything related to the current playback or global station list.
