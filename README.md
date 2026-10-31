# The Burr & Spill — Games

Twelve party games in one Next.js + Supabase app. Phones are the controllers,
any screen with the host URL is the board, and `/tv` turns a smart TV into a
read-only scoreboard with just the room code.  Whoever runs the host screen can
play from it too, no second phone needed.

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

## Owner usage dashboard

`/admin` is private to the confirmed accounts for Steve and Mike. Sign in with the existing account password. Database authorization checks the confirmed email in `auth.users`, not user-editable metadata or the browser's email check. Anonymous visitors can insert coarse usage events but cannot read them or execute the reporting function. The privileged reporting function lives in the unexposed `arcade_private` schema.

The dashboard offers 7/30/90-day ranges, a daily activity chart in Mountain time, game popularity and completion, human group sizes, self-entered player names and last-join dates, repeat play, anonymous browser visits, coarse devices, referrer hostnames, client error counts, game-link clicks, and CSV export. House bots are excluded from human counts. CSV names are escaped against spreadsheet formulas.

Names are not verified identities. Matching is case-insensitive and trims spaces. A repeat name is a name in two or more rooms during the selected period. Browser visits expire after 30 minutes without a recorded activity signal; returning browsers have two or more visits in the selected period. Browser identifiers do not identify a person across devices. “Active” means a page-view or heartbeat in the last five minutes. “Unfinished” means a room created over 24 hours ago without an ended status, not a proven abandonment. Historical data can include testing. External game clicks are not gameplay.

Game duration is captured from database status transitions only after installation. Historical room/player records can populate the other game metrics. Visit-duration estimates require multiple signals and may be understated. Referrers store hostnames only. Routes omit room codes and query strings. No game answers, IP addresses, precise location or raw error messages are stored in analytics. `/privacy` lets visitors opt out of visit analytics, and Do Not Track is respected. Dashboard and privacy routes are not tracked. Analytics failure never blocks a game.

Database installation: `supabase/migrations/20261031041234_usage_dashboard.sql` was applied to project `sztatmknjyzzyzngvpff` using `supabase db query --linked --project-ref ... --file ...`. It adds tables/functions/triggers without changing game rules. Do not reapply a completed installation. Existing unrelated database advisories are outside this change.

Verification: `npm test`, `npm run build`, targeted ESLint, and `supabase db query --linked --project-ref sztatmknjyzzyzngvpff --file supabase/tests/usage_access.sql`. Database access tests use temporary fixtures and always roll back. They verify Steve/Mike, unapproved users, unconfirmed email, anonymous writes, blocked anonymous reads/reporting, and room-code rejection.
