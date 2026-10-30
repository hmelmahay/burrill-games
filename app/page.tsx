import Link from "next/link";
import { GAME_META, type GameSlug } from "@/lib/games";
import { MikeAvatar, SteveAvatar } from "./_home/Avatars";

// Names and icons come from the registry (lib/games.ts).  This list keeps the
// card order, the blurb, and the bot advertisement.
// bots: game has house bots — playable with this many humans (bots fill the rest).
const GAMES: {
  slug: GameSlug;
  desc: string;
  bots?: { minHumans: number };
}[] = [
  {
    slug: "needle",
    desc: "Music bingo — ad-free 30-second clips, 14 pools, 700+ songs. Cards on phones, host verifies wins.",
  },
  {
    slug: "quiz",
    desc: "Speed trivia. Everyone answers on their phone — faster correct answers score more.",
    bots: { minHumans: 1 },
  },
  {
    slug: "majority",
    desc: "Vote on either/or prompts and predict which way the room will go. Points for reading the crowd.",
    bots: { minHumans: 1 },
  },
  {
    slug: "scatter",
    desc: "One letter, five categories, one minute. Unique answers score — duplicates cancel out.",
  },
  {
    slug: "emoji",
    desc: "A movie, show, or song told entirely in emoji. Type your guess — typos forgiven, speed rewarded.",
  },
  {
    slug: "ballpark",
    desc: "Nobody knows how tall the Eiffel Tower is. Closest guess takes the round.",
    bots: { minHumans: 1 },
  },
  {
    slug: "twotruths",
    desc: "Each round someone writes two truths and a lie about themselves. Spot the lie — or fool the room.",
  },
  {
    slug: "hottake",
    desc: "Who's most likely to sleep through three alarms? Vote for a player, score by reading the room.",
  },
  // Vibe before Doodle keeps the two violet cards (Two Truths, Doodle) out of
  // the same column on the two-column grid.
  {
    slug: "vibe",
    desc: "The psychic hides a spot on a scale — Hot ↔ Cold — and gives one clue. Slide your dial to where it lands.",
    bots: { minHumans: 1 },
  },
  {
    slug: "doodle",
    desc: "One player sketches live on their phone; everyone races to guess it. Artist scores per correct guess.",
  },
  {
    slug: "chain",
    desc: "FIRE → WORK → SHOP: every word pairs with the next. Race the room down a 10-word chain, or duel head-to-head on separate chains — 20s a turn, first to the bottom wins.",
  },
  {
    slug: "chameleon",
    desc: "Everyone sees the secret word except one faker. Say a one-word clue out loud, then vote out the Chameleon.",
  },
];

// Plain server component, no client JS.  The only motion is CSS:  the cards
// rise in once, 40ms apart.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 pb-6 pt-10 sm:px-6 sm:pt-12">
      <div className="flex max-w-full flex-col items-center text-center">
        <div className="flex max-w-full items-center justify-center">
          <SteveAvatar />
          <h1
            className="title-sign relative z-[1] -mx-[7px] min-w-0 pt-3 font-extrabold tracking-tight text-balance sm:-mx-[13px]"
            style={{ fontSize: "clamp(1.9rem, 7vw, 3.5rem)", lineHeight: 1.05 }}
          >
            The Burr &amp; Spill
          </h1>
          <MikeAvatar />
        </div>
        <p className="text-fog mt-2">Host a game and share the code, or join one.</p>
      </div>
      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
        {GAMES.map((g, i) => {
          const meta = GAME_META[g.slug];
          return (
            <section
              key={g.slug}
              data-game={g.slug}
              className="cabinet fx-rise flex flex-col gap-3 p-5"
              style={{ animationDelay: `${Math.min(i * 40, 520)}ms` }}
            >
              <div className="flex items-center gap-3">
                <span aria-hidden className="cabinet-icon">
                  {meta.icon}
                </span>
                <h2 className="font-display min-w-0 text-lg leading-tight text-[var(--fx-acc-core)]">{meta.name}</h2>
              </div>
              <p className="text-fog text-sm flex-1">{g.desc}</p>
              {g.bots && (
                <span className="self-start rounded-full border border-violet/60 bg-violet/10 px-2.5 py-0.5 text-xs font-semibold">
                  🤖 Bot-friendly — playable with{" "}
                  {g.bots.minHumans === 1 ? "just 1 human" : `${g.bots.minHumans}+ humans`}
                </span>
              )}
              <div className="flex gap-3">
                <Link href={`/${g.slug}/host`} className="coin-btn coin-glow flex-1">
                  <span className="coin-face py-3">Host</span>
                </Link>
                <Link href={`/${g.slug}/play`} className="coin-btn coin-ghost flex-1">
                  <span className="coin-face border-violet py-3 text-white">Join</span>
                </Link>
              </div>
            </section>
          );
        })}
      </div>
      <a href="https://burrill-arcade.vercel.app" className="text-fog text-sm underline">
        ← Back to The Burr &amp; Spill
      </a>
    </main>
  );
}
