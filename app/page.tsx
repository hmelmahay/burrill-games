import Link from "next/link";

const GAMES = [
  {
    slug: "quiz",
    icon: "⚡",
    name: "Quiz Rush",
    desc: "Speed trivia. Everyone answers on their phone — faster correct answers score more.",
  },
  {
    slug: "majority",
    icon: "🐑",
    name: "Majority Rules",
    desc: "Vote on either/or prompts and predict which way the room will go. Points for reading the crowd.",
  },
  {
    slug: "scatter",
    icon: "📝",
    name: "Scatter Sprint",
    desc: "One letter, five categories, one minute. Unique answers score — duplicates cancel out.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-6 pt-12">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-glow">Burrill</span>{" "}
          <span className="text-violet">Arcade Games</span>
        </h1>
        <p className="text-fog mt-2">Host a game and share the code, or join one.</p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-md">
        {GAMES.map((g) => (
          <section
            key={g.slug}
            className="rounded-2xl bg-card border border-line p-5 flex flex-col gap-3"
          >
            <h2 className="text-xl font-bold">
              {g.icon} {g.name}
            </h2>
            <p className="text-fog text-sm">{g.desc}</p>
            <div className="flex gap-3">
              <Link
                href={`/${g.slug}/host`}
                className="flex-1 rounded-xl bg-glow text-[#1a1000] text-center py-3 font-bold"
              >
                Host
              </Link>
              <Link
                href={`/${g.slug}/play`}
                className="flex-1 rounded-xl border-2 border-violet text-center py-3 font-bold"
              >
                Join
              </Link>
            </div>
          </section>
        ))}
      </div>
      <a href="https://burrill-arcade.vercel.app" className="text-fog text-sm underline">
        ← Back to The Burrill Arcade
      </a>
    </main>
  );
}
