"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { MajorityRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { useStaged } from "@/lib/motion";
import { playerKey } from "@/lib/rooms";
import { MajorityPhaseData } from "@/app/majority/constants";
import { PlayerPanel } from "@/app/majority/PlayerPanel";
import { SplitBar } from "@/app/majority/SplitBar";
import { REVEAL } from "@/app/majority/reveal";

export default function MajorityPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("majority", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  // Visual only: should this phone play the staged reveal for the current phase?
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const round = room ? (room.rounds[room.round_idx] as MajorityRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as MajorityPhaseData;
  const me = players.find((p) => p.id === playerId);

  if (error)
    return (
      <Shell title="Majority Rules" icon="🐑">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/majority/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Majority Rules" icon="🐑">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/majority/play">Join first.</Link>
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
    <Shell title={`Majority Rules · ${me.name}`} icon="🐑">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "vote" && round && playerId && (
        <PlayerPanel room={room} subs={subs} playerId={playerId} />
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-sm font-bold">
                <span className="min-w-0 break-words text-glow">{round.a}</span>
                <span className="min-w-0 break-words text-right text-[#a78bfa]">{round.b}</span>
              </div>
              <SplitBar aCount={phaseData.aCount ?? 0} bCount={phaseData.bCount ?? 0} size="sm" />
            </div>
            {/* Same beat as the host's verdict stamp, so the phone never spoils it. */}
            {myResult && (
              <ResultCard
                tone={myResult.gained > 0 ? "win" : "lose"}
                points={myResult.gained > 0 ? myResult.gained : undefined}
                delayMs={REVEAL.verdict}
                title={
                  myResult.vote == null
                    ? "No vote in time"
                    : phaseData.majority === "tie"
                      ? "Dead tie.  Everybody who voted scores."
                      : myResult.gained > 0
                        ? "You read the room!"
                        : "The room went the other way"
                }
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
