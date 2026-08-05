# AGENTS.md — The Burr & Spill (burrill-games)

> `CLAUDE.md` is a symlink to this file — they are the same document. Edit this one; don't replace the symlink with a copy.

Eleven party games in one Next.js + Supabase app, deployed at **burrill-games.vercel.app**. A collaboration between Steve (hmelmahay) and Mike (SpyderMYK) — both have push access. Prefer branch → PR → merge; the arcade grew out of the same GitHub-learning habit as [party-bluff](https://github.com/hmelmahay/party-bluff).

## Shape of the app

| Path | Role |
|---|---|
| `app/<game>/host/page.tsx` | Setup screen — pick options, create the room, land on the room's host page |
| `app/<game>/host/[code]/page.tsx` | The room's shared scoreboard **and** the game engine: it advances phases, scores rounds, and drives the bots |
| `app/<game>/play/page.tsx` → `play/[code]/page.tsx` | The phone view — join, then submit whatever the current phase asks for |
| `lib/useRoom.ts` | Live view of one room (row + players + this round's submissions) over Supabase Realtime, with a 5s backstop poll |
| `lib/rooms.ts` | `createRoom` / `joinRoom`, 4-char codes, `localStorage` keys for rehydrating on refresh |
| `app/components/ui.tsx` | Shared chrome — `Shell`, `CodeBadge`, `Leaderboard`, `PlayerChips`, `BigBtn` |

All state lives in three Supabase tables — `arcade_rooms`, `arcade_players`, `arcade_subs` — so a refresh or a server restart never loses a game.

**The host page is the engine.** Phase transitions, scoring, and bot turns all run in whoever has the host screen open. Two consequences worth internalising: anything needing a secret must be a server route (see below), and `/tv` spectators must never run engine logic — that's what the `tvRef` guard from `useSpectator` is for. Check it before any effect that writes.

## House bots

| File | Role |
|---|---|
| `lib/bot-logic.ts` | **Pure** — no imports at all, so it is unit-testable without a database |
| `lib/bots.ts` | Seating/removal against Supabase; re-exports the pure helpers so callers have one import |
| `lib/useBots.ts` | Schedules each bot's submission for the current round |
| `lib/useBotAnswer.ts` | Asks the answer service what this seat should answer |

Bots are ordinary `arcade_players` rows whose names match an exact house roster (Ada, Brick, Cleo, Dot, Ember, Fig, Gus) — no schema change, and every chip list and leaderboard renders them correctly for free. Matching is by exact name, not by the 🤖 suffix, so a human who names themselves "Dave 🤖" stays human.

### Bots must not cheat

**A bot may never derive its answer from something a real player in that seat could not see** — not the secret target, not the correct answer. This rule is why `/api/bots/answer` exists.

The first implementation broke it: guesses were `noise(round.target)` / `noise(round.answer)`. It looked convincing and played badly — in Vibe Check the psychic's score became a dice roll, because clue quality had no effect on where the bots landed.

Concretely:

- Give the bot only what the player sees (the clue, the question, the choices) and let it work the answer out.
- Simulate skill as noise on **the bot's own attempt**, never on the truth. `botQuizPick` makes a fuzzy bot second-guess its own pick; the dial and numeric guesses centre on the bot's own estimate.
- When the answer service is unavailable, bots guess **blind** — `botBlindDial`, `botBlindChoice`, `botBlindNumber` take no answer argument at all, so peeking isn't reachable from that path. Say so on screen; each game already does.
- Majority Rules never needed the service — there's no ground truth to peek at, so its bots read the prompt like everyone else. It derives a per-prompt crowd leaning so a plurality actually forms; independent coin flips would make predicting the room pure luck.
- Hot Take has **no bots by design**: "who's most likely to…" is about the actual people in the room, and a bot voting for (or receiving votes as) a house name is meaningless. Don't add them back.

### `POST /api/bots/answer`

Takes a Vibe Check clue, a multiple-choice question, or a numeric question; returns that seat's answer. Anthropic SDK, `claude-opus-5`, structured outputs, `effort: "low"` (bots answer inside a live round), refusal fallbacks on. **One call per round, not per bot.**

Needs `ANTHROPIC_API_KEY` in the Vercel project. Without it the route returns 503, bots play blind, and the games keep working. Server-side because the bots run in the host's browser and the key must never go there.

Adding bots to a new game is a payload function plus a lobby button — and a `bots: { minHumans }` entry in `app/page.tsx` to advertise it on the hub card.

## Running & testing

```bash
npm install
npm run dev     # http://localhost:3100
npm test        # 75 assertions, no new deps, no build step
npm run build   # verifies routes compile
```

`npm test` runs `lib/bots.test.ts` through node's built-in type stripping — no test framework to install. It covers bot identification, seating, skill stability, guess distributions, the Vibe clue bank, and a replay of the host's own scoring maths. **Extend it when you touch `lib/bot-logic.ts`** — it has caught real bugs twice: a clue that leaked its own scale word, and a crowd-leaning setting that left a quarter of rounds tied.

Local dev needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (both are public browser-side values) — see `.env.example`. For a build-only check, any placeholder works.

CI (`.github/workflows/ci.yml`) runs `npm test` and `npm run build` on every PR and is a **required check on `main`** — no human approvals are required, green CI is the only gate. Don't gate lint until the ~49 pre-existing errors are cleaned up.

## Deployment

`main` is protected: branch → PR → green CI → merge, no direct pushes. Merges to `main` auto-deploy to production. **Branch pushes on this repo get an automatic preview URL** — fork PRs do not (they need per-commit authorization), so push branches here rather than to a fork. If preview deployments start returning a 403 "Vercel Security Checkpoint", deployment protection got re-enabled: Settings → Deployment Protection → Vercel Authentication → disable for Preview.

## Conventions & gotchas

- **Verify in a browser before merging.** Unit tests can't see effect lifecycles: a Quiz Rush round shipped-but-for-one-check ended 2/3 answered because every submission cancelled and rescheduled the other bots' timers. Only playing it found that.
- Pre-existing lint errors (~49, mostly `setState`-in-effect in `useRoom.ts`) are not yours. Compare against the base branch before blaming a change.
- The room creator can play: the host setup page takes a name and seats them, and the host screen renders their controls inline via `app/vibe/PlayerPanel.tsx`. Leave the name blank for a scoreboard-only screen (right for a TV).
- Supabase error `23505` is a duplicate submission — expected under races, swallow it rather than retrying.
- `arcade_subs` is keyed per round; always filter by `round_idx` before reading a player's answer.
