# RadioStack

A premium, high-density radio directory and player built for power users. Modernized with a **Linear/Notion-inspired** utility-first design, featuring high-contrast aesthetics and robust station management.

Built with **Next.js 16**, **Firebase (Firestore)**, **Zustand**, and **Tailwind CSS 4**.

## Key Features

### Pro Playback Experience
- **Persistent Player**: The `PlayerBar` stays mounted while the Settings admin panel opens as a modal overlay on top of it, so audio keeps playing while you manage the directory.
- **Smart Navigation**: Sequential and Shuffle playback modes with automatic loop-around across the current category.
- **Hardware Integration**: Full **Media Session API** support for OS-level control via hardware media keys (Play/Pause, Next/Prev).
- **Now Playing Metadata**: Polls an ICY-metadata proxy (`/api/metadata`) every 15s to surface the current track title/artist when the stream exposes it.
- **Live Equalizer**: A Web Audio `AnalyserNode`-driven canvas visualizer.
- **Stream Monitoring**: Real-time error detection on the audio element with an inline "Offline" badge for failing streams.
- **Scroll to Active**: Instantly locate the currently playing station in the grid; it is briefly ring-highlighted.

### Advanced Management
- **Bulk Import Engine**: Import station lists via M3U/M3U8 text or file uploads. The import API is rate-limited to 3 requests per 60 seconds per IP.
- **Multi-Format Export**: Export the active directory in **M3U, M3U8, CSV, TXT, or XSPF** formats (generated client-side).
- **Bulk Actions**: Select multiple stations in the browser grid to **delete** or **move to a category** simultaneously via a dedicated action bar (admin only).
- **Trash & Recovery**: Deletes are soft (a `deletedAt` timestamp). The **Trash** tab restores individual stations or whole categories, or purges the trash permanently.
- **Offline Tab**: Lists stations flagged `isLive = false` so an admin can re-activate them.
- **User Approval**: New (non-admin) sign-ups land in a pending state; the admin approves them from the **Pending** tab, which sets a Firebase custom claim and a Firestore flag.

### Premium Interface
- **High-Density Grid**: Information-dense layout optimized for managing hundreds of stations.
- **Neon Utility Aesthetic**: Professional dark mode with sharp edges and distinct neon-yellow (`#e8ff00`) accents.
- **Smart Search**: Real-time filtering with visual highlighting of matching search terms.
- **Favorites**: Per-user favorites synced to Firestore (requires sign-in).
- **Mobile Responsive**: Categorical navigation and grids optimized for fluid use across all devices.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack in dev)
- **UI Library**: React 19
- **Database**: Cloud Firestore (via `firebase-admin` on the server, `firebase` web SDK on the client)
- **Auth**: Firebase Authentication (email/password) with a custom-claim approval flow
- **Storage**: Firebase Storage (station logo uploads)
- **State Management**: Zustand (player store)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Analytics**: Vercel Speed Insights

> Note: there is **no Prisma and no PostgreSQL** in the running application. The `supabase/` directory, `*.sql` files, and the `DATABASE_URL` in `.env.example` are leftover artifacts from an earlier design and are not used by the code.

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/waldseelen/RadioStack.git
   cd RadioStack
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Firebase**:
   Create a Firebase project with Firestore, Authentication (Email/Password), and Storage enabled, then provide credentials via `.env.local`.

   Client (browser) config:
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

   Server (Admin SDK) credentials — either these environment variables:
   ```bash
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY=...   # newlines escaped as \n
   ```
   ...or drop a service-account JSON at `firebase-service-account.json` in the project root (git-ignored). In a GCP/emulator environment the Admin SDK falls back to default credentials.

   > The admin account is identified by the hard-coded email `admin@radiostack.com`. Create this user in Firebase Auth to access the admin panel.

4. **Seed data (optional)**:
   There is no `npm` seed script. Sample station data lives in `stations.json` / `stations.m3u`, and `generate-seed.mjs` can regenerate it. You can also populate stations at runtime through the admin panel's M3U import.

5. **Start the development server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). The admin panel is accessible via the "Settings" button next to the search bar (requires signing in as `admin@radiostack.com`).

## Scripts

```bash
npm run dev       # next dev --turbopack
npm run build     # next build
npm run start     # next start
npm run lint      # eslint
npm run analyze   # ANALYZE=true next build (bundle analyzer)
```

## License

MIT
