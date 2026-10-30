"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { BallparkRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard, RollingNumber } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { useStaged } from "@/lib/motion";
import { playerKey } from "@/lib/rooms";
import { BallparkPhaseData } from "@/app/ballpark/constants";
import { PlayerPanel } from "@/app/ballpark/PlayerPanel";
import { EDGE_CLIP, REVEAL } from "@/app/ballpark/reveal";
import { formatterFor } from "@/app/ballpark/format";

export default function BallparkPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("ballpark", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  // Display only: play the reveal if this phone saw it start, else show the end state.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  const round = room ? (room.rounds[room.round_idx] as BallparkRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as BallparkPhaseData;
  const me = players.find((p) => p.id === playerId);

  if (error)
    return (
      <Shell title="Ballpark" icon="🎯">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/ballpark/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Ballpark" icon="🎯">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/ballpark/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  // Years print as 1903, not 1,903.
  const fmt = formatterFor(round);

  return (
    <Shell title={`Ballpark · ${me.name}`} icon="🎯">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <div className="neon-panel p-5 text-center">
            <h1 className="text-xl font-extrabold">{round.q}</h1>
          </div>
          {playerId && <PlayerPanel room={room} subs={subs} playerId={playerId} />}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4" style={EDGE_CLIP}>
            <div className="neon-panel p-5 text-center">
              <div className="text-fog text-sm">{round.q}</div>
              <div className="text-3xl font-extrabold mt-1">
                {/* Same count-up as the host screen, ending as its flag lands. */}
                <RollingNumber
                  from={staged && Number.isInteger(round.answer) ? 0 : round.answer}
                  value={round.answer}
                  ms={REVEAL.flag}
                  format={fmt}
                  landAtEnd
                />{" "}
                {round.unit}
              </div>
            </div>
            {/* The card and the board wait past the host's flag (see reveal.ts). */}
            {myResult && (
              <ResultCard
                tone={myResult.gained >= 500 ? "win" : "neutral"}
                points={myResult.gained}
                celebrate={myResult.distance === 0}
                delayMs={REVEAL.phoneCard}
                title={
                  myResult.guess == null
                    ? "No guess in time"
                    : myResult.distance === 0
                      ? "DEAD ON. Are you psychic?"
                      : `You said ${fmt(myResult.guess)}, off by ${myResult.distance!.toLocaleString()}`
                }
              />
            )}
            <Reveal kind="fade" delayMs={REVEAL.phoneBoard}>
              <Leaderboard players={players} highlightId={playerId} gains={gains} />
            </Reveal>
            <p className="text-fog text-sm text-center">Waiting for the host…</p>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <div style={EDGE_CLIP}>
          <FinalStandings players={players} highlightId={playerId} size="phone" staged={staged} />
        </div>
      )}
    </Shell>
  );
}
