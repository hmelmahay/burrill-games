"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ScatterRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { useStaged } from "@/lib/motion";
import { playerKey } from "@/lib/rooms";
import { POINTS_PER_ANSWER, ScatterPhaseData } from "@/app/scatter/constants";
import { PlayerPanel } from "@/app/scatter/PlayerPanel";
import { REVEAL } from "@/app/scatter/reveal";

export default function ScatterPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("scatter", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as { roundSeconds?: number };
  const roundSeconds = settings.roundSeconds ?? 60;
  const round = room ? (room.rounds[room.round_idx] as ScatterRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ScatterPhaseData;
  const me = players.find((p) => p.id === playerId);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    roundSeconds,
    room?.phase === "write",
  );
  // A refreshed phone gets the final screen at once instead of a replay.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  if (error)
    return (
      <Shell title="Scatter Sprint" icon="📝">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/scatter/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Scatter Sprint" icon="📝">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/scatter/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const results = phaseData.results ?? [];
  const myResult = results.find((r) => r.player_id === playerId);
  const gains: Record<string, number> = {};
  results.forEach((r) => (gains[r.player_id] = r.gained));
  const myScored = myResult ? myResult.cells.filter((c) => c.s === "ok").length : 0;

  return (
    <Shell title={`Scatter Sprint · ${me.name}`} icon="📝">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "write" && round && (
        <div className="flex flex-col gap-3">
          <Countdown left={left} total={roundSeconds} doneLabel="Pencils down" />
          <div className="neon-panel p-3 text-center">
            <span className="text-fog text-sm mr-2">Everything starts with</span>
            <span className="text-4xl font-extrabold text-glow align-middle">
              {round.letter}
            </span>
          </div>
        </div>
      )}

      {/* Mounted through judging so a sheet that wasn't sent yet still lands. */}
      {(room.phase === "write" || room.phase === "judge") && playerId && (
        <PlayerPanel room={room} subs={subs} playerId={playerId} left={left} />
      )}

      {room.phase === "judge" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">⚖️</p>
          <h1 className="text-xl font-extrabold">Pencils down!</h1>
          <p className="text-fog text-center">
            The host is judging answers. Defend yours out loud.
          </p>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            {/* The card waits past the host's board (shown at once), and the
                board here follows the card, so this phone never shows the
                round's points before the room sees them. */}
            {myResult && (
              <ResultCard
                tone={myResult.gained > 0 ? "win" : "neutral"}
                points={myResult.gained > 0 ? myResult.gained : undefined}
                title={
                  myScored > 0
                    ? `${myScored} ${myScored === 1 ? "answer" : "answers"} scored`
                    : "No answers scored this round"
                }
                delayMs={REVEAL.phoneCard}
              >
                <ul className="text-sm mt-2 text-left">
                  {myResult.cells.map((cell, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      {/* A 40-letter word wraps inside its own column, so the
                          label beside it stays on the card. */}
                      <span
                        className={`min-w-0 break-words ${cell.s === "ok" ? "" : "line-through opacity-70"}`}
                      >
                        {round.categories[i]}: {cell.a || "—"}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {cell.s === "ok" && `+${POINTS_PER_ANSWER}`}
                        {cell.s === "dupe" && "duplicate"}
                        {cell.s === "invalid" && "wrong letter"}
                        {cell.s === "rejected" && "rejected"}
                      </span>
                    </li>
                  ))}
                </ul>
              </ResultCard>
            )}
            <Reveal kind="fade" delayMs={REVEAL.phoneBoard}>
              <Leaderboard players={players} highlightId={playerId} gains={gains} />
            </Reveal>
            <p className="text-fog text-sm text-center">Waiting for the host…</p>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={playerId} size="phone" staged={staged} />
      )}
    </Shell>
  );
}
