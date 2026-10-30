"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { useStaged } from "@/lib/motion";
import { Shell, Leaderboard } from "@/app/components/ui";
import { Drumroll, LobbyWait, Reveal, RevealScope, ResultCard, Stamp } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { playerKey } from "@/lib/rooms";
import { WordGrid } from "@/app/chameleon/WordGrid";
import { PlayerPanel } from "@/app/chameleon/PlayerPanel";
import { LizardCycle } from "@/app/chameleon/LizardCycle";
import { REVEAL, outcomeStamp, revealTease } from "@/app/chameleon/reveal";
import {
  ESCAPE_POINTS,
  CAUGHT_BUT_GUESSED_POINTS,
  CATCHERS_POINTS,
  ChamRound,
  ChamPhaseData,
} from "@/app/chameleon/constants";

export default function ChameleonPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("chameleon", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  // Same staging rule as the host screen, so a refreshed phone skips the replay.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  const rounds = (room?.rounds ?? []) as ChamRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as ChamPhaseData;
  const me = players.find((p) => p.id === playerId);

  if (error)
    return (
      <Shell title="Chameleon" icon="🦎">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/chameleon/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Chameleon" icon="🦎">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/chameleon/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const iWasChameleon = round?.chameleon_id === playerId;
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const stamp = round ? outcomeStamp(phaseData, round.secret_idx) : null;

  return (
    <Shell title={`Chameleon · ${me.name}`} icon="🦎">
      {room.phase === "lobby" && (
        <LobbyWait
          me={me}
          players={players}
          note={
            <p className="text-fog text-sm">
              {players.length} player{players.length === 1 ? "" : "s"} so far
            </p>
          }
        />
      )}

      {(room.phase === "clue" || room.phase === "vote" || room.phase === "guess") && playerId && (
        <>
          {room.phase === "clue" && round && (
            <p className="text-fog text-sm text-center mb-3">
              Round {room.round_idx + 1}/{rounds.length} · topic: <b>{round.topic}</b>
            </p>
          )}
          <PlayerPanel room={room} players={players} subs={subs} playerId={playerId} />
        </>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          {/* overflow-x-clip:  the outcome and result cards wait at 1.8x for their
              slams and must not widen the phone screen.  -mx-4 px-4 put the clip
              at the Shell's edge. */}
          <div className="-mx-4 flex flex-col gap-4 overflow-x-clip px-4">
            <Drumroll ms={REVEAL.drum} tease={<span className="block text-center">{revealTease(phaseData.caught)}</span>}>
              <div
                className={`rounded-2xl border-2 p-4 text-center ${
                  iWasChameleon
                    ? (myResult?.gained ?? 0) > 0
                      ? "border-win bg-win/10"
                      : "border-lose bg-lose/10"
                    : "border-line bg-card"
                }`}
              >
                <div className="text-2xl">
                  <LizardCycle cycle={!phaseData.caught} />
                </div>
                <div className="text-lg font-extrabold">
                  {round.chameleon_name} was the Chameleon
                </div>
                {stamp && (
                  <div className="mt-2">
                    <Stamp tone={stamp.tone} size="md" delayMs={200}>
                      {stamp.label}
                    </Stamp>
                  </div>
                )}
                <p className="text-fog text-sm mt-2">
                  {!phaseData.caught
                    ? `They escaped the vote! +${ESCAPE_POINTS} for the Chameleon.`
                    : phaseData.guess_idx == null
                      ? `Caught, and gave up on the guess — everyone else +${CATCHERS_POINTS}.`
                      : phaseData.guess_idx === round.secret_idx
                        ? `Caught, but guessed the word! +${CAUGHT_BUT_GUESSED_POINTS} for the Chameleon.`
                        : `Caught and guessed wrong — everyone else +${CATCHERS_POINTS}.`}
                </p>
              </div>
            </Drumroll>
            <WordGrid
              words={round.words}
              highlightIdx={round.secret_idx}
              pickedIdx={
                phaseData.guess_idx != null && phaseData.guess_idx !== round.secret_idx
                  ? phaseData.guess_idx
                  : null
              }
              flipDelayMs={REVEAL.grid}
            />
            {myResult && myResult.gained > 0 && (
              <ResultCard
                tone="win"
                points={myResult.gained}
                title={myResult.wasChameleon ? "Slippery. Very slippery." : "You saw right through them."}
                delayMs={REVEAL.phoneCard}
              />
            )}
            <Reveal kind="fade" delayMs={REVEAL.phoneBoard}>
              <Leaderboard players={players} highlightId={playerId} gains={gains} />
            </Reveal>
            {/* Waits with the board: its position would hint at the hidden result card. */}
            <Reveal kind="fade" delayMs={REVEAL.phoneBoard} as="p" className="text-fog text-sm text-center">
              Waiting for the host…
            </Reveal>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={playerId} size="phone" staged={staged} />
      )}
    </Shell>
  );
}
