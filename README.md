# The Burr & Spill — Games

Ten party games in one Next.js + Supabase app. Phones are the controllers,
any screen with the host URL is the board, and `/tv` turns a smart TV into a
read-only scoreboard with just the room code.

Live: https://burrill-games.vercel.app · Hub: https://burrill-arcade.vercel.app

## Working on it

- **Push to `main` deploys automatically** (Vercel is connected to this repo).
  Branch pushes get preview URLs on their own.
- `npm run dev` — local dev server (needs `.env.local` with
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; both are the
  public browser values, extractable from any page's network tab).
- Games follow a shared pattern: rooms/players/submissions tables, host screen
  advances phases, players submit, host computes scores at reveal. Copy an
  existing game's four pages (`host/`, `host/[code]/`, `play/`, `play/[code]/`)
  to start a new one.

Built by Steve Burrill & Mike Spille (and their robot).
