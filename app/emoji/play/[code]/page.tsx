"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { EmojiRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { useStaged } from "@/lib/motion";
import { playerKey } from "@/lib/rooms";
import { EmojiPhaseData } from "@/app/emoji/constants";
import { PlayerPanel } from "@/app/emoji/PlayerPanel";
import { NowShowing } from "@/app/emoji/NowShowing";
import { REVEAL } from "@/app/emoji/reveal";

export default function EmojiPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("emoji", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as { guessSeconds?: number };
  const guessSeconds = settings.guessSeconds ?? 30;
  const round = room ? (room.rounds[room.round_idx] as EmojiRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as EmojiPhaseData;
  const me = players.find((p) => p.id === playerId);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    guessSeconds,
    room?.phase === "guess",
  );
  // A refreshed phone gets the final screen at once instead of a replay.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  if (error)
    return (
      <Shell title="Emoji Cinema" icon="🎬">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/emoji/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Emoji Cinema" icon="🎬">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/emoji/play">Join first.</Link>
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
  // The first right answer scores the most (BASE_POINTS + SPEED_BONUS[0]), so
  // the top score among right answers is the fastest.
  const solvers = results
    .filter((r) => r.correct)
    .sort((a, b) => b.gained - a.gained)
    .map((r) => r.player_id);
  const myPlace = playerId ? solvers.indexOf(playerId) + 1 : 0;

  return (
    <Shell title={`Emoji Cinema · ${me.name}`} icon="🎬">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <Countdown left={left} total={guessSeconds} />
          <NowShowing compact emoji={round.emoji} kind={round.kind} />
          {playerId && <PlayerPanel room={room} subs={subs} playerId={playerId} left={left} />}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <NowShowing compact emoji={round.emoji} kind={round.kind} answer={round.answer} />
            {myResult && (
              <ResultCard
                tone={myResult.correct ? "win" : "lose"}
                points={myResult.correct ? myResult.gained : undefined}
                title={
                  myResult.correct
                    ? myPlace === 1
                      ? "Fastest right answer!"
                      : "You got it!"
                    : myResult.guess
                      ? "Not this time"
                      : "No guess in time"
                }
                celebrate={myResult.correct && myPlace === 1}
                delayMs={REVEAL.title}
              >
                {!myResult.correct && myResult.guess && (
                  <p className="text-sm mt-1 break-words">You guessed “{myResult.guess}”</p>
                )}
              </ResultCard>
            )}
            <Reveal kind="fade" delayMs={REVEAL.board}>
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
