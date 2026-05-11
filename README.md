# RadioStack

A premium, high-density radio directory and player built for power users. Modernized with a **Linear/Notion-inspired** utility-first design, featuring high-contrast aesthetics and robust station management.

Built with **Next.js 15**, **Prisma 6**, **Zustand**, and **Tailwind CSS 4**.

## Key Features

### 🎧 Pro Playback Experience
- **Persistent Player**: Seamless listening experience with audio that persists even while navigating the settings dashboard.
- **Smart Navigation**: Sequential and Shuffle playback modes with automatic loop-around.
- **Hardware Integration**: Full **Media Session API** support for OS-level control via hardware media keys (Play/Pause, Next/Prev).
- **Stream Monitoring**: Real-time error detection with "Offline" status alerts for failing streams.
- **Scroll to Active**: Instantly locate your currently playing station in the grid with a single click.

### 🗃️ Advanced Management
- **Bulk Import Engine**: Rapidly import station lists via M3U/M3U8 text or file uploads with built-in rate limiting.
- **Multi-Format Export**: Export your curated directory in **M3U, M3U8, CSV, TXT, or XSPF** formats.
- **Bulk Actions**: Select multiple stations to delete or move categories simultaneously via a dedicated action bar.
- **Trash & Recovery**: Safe deletion with a full-featured trash bin for individual or categorical restoration.

### 🎨 Premium Interface
- **High-Density Grid**: Information-dense layout optimized for managing hundreds of stations.
- **Neon Utility Aesthetic**: Professional dark mode with sharp edges and distinct neon-yellow (`#e8ff00`) accents.
- **Smart Search**: Real-time filtering with visual highlighting of matching search terms.
- **Mobile Responsive**: Categorical navigation and grids optimized for fluid use across all devices.

## Tech Stack

- **Framework**: Next.js 15 (using Turbopack)
- **UI Library**: React 19
- **Database & ORM**: Prisma 6 with PostgreSQL
- **State Management**: Zustand
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Notifications**: Sonner

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

3. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   # Set your DATABASE_URL in .env.local
   ```

4. **Initialize Database**:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). The settings panel is accessible via the "Settings" button next to the search bar.

## License

MIT
