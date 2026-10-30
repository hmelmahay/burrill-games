"use client";

import type { ReactNode } from "react";
import type { Player } from "@/lib/supabase";
import { competitionRanks, joinNames, ordinal } from "@/lib/fx";
import { Marquee, PlayerDot } from "./brand";
import { Reveal, RevealScope, RollingNumber } from "./fx";
import { Confetti } from "./Confetti";

// Podium step heights in rem for places 1, 2, 3.
const HEIGHTS = { phone: [7, 5, 4], host: [9, 6.5, 5], stage: [14, 10, 7] } as const;
// Steps rise 3rd, 2nd, 1st.
const STEP_AT = { 1: 700, 2: 350, 3: 0 } as const;
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;

// Replaces every "🏆 Final standings" block (host, phone and the quiz stage).
export function FinalStandings({
  players,
  highlightId,
  size = "host",
  staged = true,
  children,
}: {
  players: Player[];
  highlightId?: string | null;
  size?: "phone" | "host" | "stage";
  staged?: boolean;
  children?: ReactNode;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const ranks = competitionRanks(sorted.map((p) => p.score));
  const top = sorted[0]?.score ?? 0;
  const atPlace = (place: 1 | 2 | 3) => sorted.filter((_, i) => ranks[i] === place);
  const winners = atPlace(1);
  const rest = sorted.map((p, i) => ({ p, rank: ranks[i] })).filter((r) => r.rank > 3);
  const meIdx = highlightId ? sorted.findIndex((p) => p.id === highlightId) : -1;
  const myRank = meIdx >= 0 ? ranks[meIdx] : null;
  const tied = myRank != null && ranks.filter((r) => r === myRank).length > 1;
  const celebrate = top > 0 && (size !== "phone" || myRank === 1);
  const big = size === "stage";

  return (
    <RevealScope staged={staged}>
      <div className="flex flex-col items-center gap-5 w-full">
        <Marquee title="Game over" size="lg" burstKey="gameover" />
        {top > 0 ? (
          <div className="flex items-end justify-center gap-3 w-full max-w-3xl">
            {([2, 1, 3] as const).map((place) => {
              const group = atPlace(place);
              if (group.length === 0) return null;
              const at = STEP_AT[place];
              return (
                <div key={place} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <Reveal kind="pop" delayMs={at + 350} className="flex flex-col items-center gap-1 w-full min-w-0">
                    <span className={big ? "text-5xl" : "text-3xl"}>{MEDAL[place]}</span>
                    {group.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={`font-extrabold truncate max-w-full ${big ? "text-3xl" : "text-lg"} ${
                          p.id === highlightId ? "neon-text" : ""
                        }`}
                      >
                        {p.name}
                      </span>
                    ))}
                    {group.length > 3 && <span className="text-fog text-sm">+{group.length - 3} more</span>}
                    <RollingNumber
                      from={0}
                      value={group[0].score}
                      className={`font-mono font-bold text-fog ${big ? "text-2xl" : ""}`}
                    />
                  </Reveal>
                  <Reveal
                    kind="bar-y"
                    delayMs={at}
                    className={`podium-block place-${place}`}
                    style={{ height: `${HEIGHTS[size][place - 1]}rem` }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-fog">No points this time.</p>
        )}
        {top > 0 && (
          <Reveal kind="slam" delayMs={1100}>
            <p className={`font-display neon-text text-center ${big ? "text-4xl" : "text-2xl"}`}>
              {winners.length === 1 ? `${winners[0].name} wins!` : `${joinNames(winners.map((w) => w.name))} tie!`}
            </p>
          </Reveal>
        )}
        {celebrate && <Confetti pieces={big ? 48 : 36} delayMs={1300} />}
        {myRank != null && size === "phone" && (
          <Reveal kind="fade" delayMs={1500}>
            <p className="text-fog">
              You {tied ? "tied for" : "finished"} {ordinal(myRank)} of {players.length}.
            </p>
          </Reveal>
        )}
        {rest.length > 0 && (
          <ol className="flex flex-col gap-1.5 w-full max-w-xl">
            {rest.map(({ p, rank }, i) => (
              <Reveal
                as="li"
                key={p.id}
                kind="rise"
                delayMs={1500 + i * 60}
                className={`hiscore-row gap-3 ${p.id === highlightId ? "is-me" : ""}`}
              >
                <span className="w-8 text-center font-bold text-fog">{rank}</span>
                <PlayerDot id={p.id} name={p.name} size="sm" />
                <span className="flex-1 font-semibold truncate">{p.name}</span>
                <span className="font-mono font-bold tabular-nums">{p.score.toLocaleString()}</span>
              </Reveal>
            ))}
          </ol>
        )}
        {children}
      </div>
    </RevealScope>
  );
}
