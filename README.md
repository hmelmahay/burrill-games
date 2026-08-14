# The Burr & Spill — Games

Twelve party games in one Next.js + Supabase app. Phones are the controllers,
any screen with the host URL is the board, and `/tv` turns a smart TV into a
read-only scoreboard with just the room code.

Live: https://burrill-games.vercel.app · Hub: https://burrill-arcade.vercel.app

## Working on it

- **main is protected: changes land by PR, and the only gate is green CI**
  (tests + build — no human approvals required, ever). The frictionless flow:
  ```
  git checkout -b my-thing   # work, commit
  git push -u origin my-thing
  gh pr create --fill
  gh pr merge --auto --squash   # merges itself when CI passes
  ```
  Merged code deploys to production automatically; branch pushes get their own
  preview URLs. Broken? `git revert` on a branch and repeat — the revert ships
  itself too.
- Lint has pre-existing errors and is **not** CI-gated yet; `npm run lint`
  locally, and once it's clean add it to `.github/workflows/ci.yml`.
- `npm run dev` — local dev server (needs `.env.local` with
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; both are the
  public browser values, extractable from any page's network tab).
- Games follow a shared pattern: rooms/players/submissions tables, host screen
  advances phases, players submit, host computes scores at reveal. Copy an
  existing game's four pages (`host/`, `host/[code]/`, `play/`, `play/[code]/`)
  to start a new one.

Built by Steve Burrill & Mike Spille (and their robot).
