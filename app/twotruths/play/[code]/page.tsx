"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { useStaged } from "@/lib/motion";
import { Shell, Leaderboard } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { playerKey } from "@/lib/rooms";
import { TTRound, TTPhaseData } from "@/app/twotruths/constants";
import { PlayerPanel } from "@/app/twotruths/PlayerPanel";
import { Verdicts } from "@/app/twotruths/Verdicts";
import { REVEAL } from "@/app/twotruths/reveal";

export default function TTPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("twotruths", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  // Same staging rule as the host screen, so a refreshed phone skips the replay.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  const rounds = (room?.rounds ?? []) as TTRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as TTPhaseData;
  const me = players.find((p) => p.id === playerId);
  const isAuthor = round?.author_id === playerId;

  if (error)
    return (
      <Shell title="Two Truths & a Lie" icon="🤥">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/twotruths/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Two Truths & a Lie" icon="🤥">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/twotruths/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title={`Two Truths & a Lie · ${me.name}`} icon="🤥">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {(room.phase === "write" || room.phase === "vote") && round && playerId && (
        <PlayerPanel room={room} subs={subs} playerId={playerId} />
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          {/* overflow-x-clip:  the result card waits at 1.8x for its slam and must
              not widen the phone screen.  -mx-4 px-4 put the clip at the Shell's edge. */}
          <div className="-mx-4 flex flex-col gap-4 overflow-x-clip px-4">
            <Verdicts
              statements={phaseData.statements ?? []}
              lie={phaseData.lie}
              results={phaseData.results ?? []}
              compact
            />
            {myResult && (
              <ResultCard
                tone={myResult.gained > 0 ? "win" : "lose"}
                points={myResult.gained > 0 ? myResult.gained : undefined}
                title={
                  isAuthor
                    ? myResult.gained > 0
                      ? "Your lie fooled them!"
                      : "Nobody fell for it."
                    : myResult.correct
                      ? "You spotted the lie!"
                      : myResult.vote == null
                        ? "No vote in time"
                        : "Fooled!"
                }
                delayMs={REVEAL.card}
              />
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
