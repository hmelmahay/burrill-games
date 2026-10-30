"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard, RollingNumber } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { playerHue } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { playerKey } from "@/lib/rooms";
import { VibeRound, VibePhaseData } from "@/app/vibe/constants";
import { Dial } from "@/app/vibe/Dial";
import { BULLSEYE, EDGE_CLIP, REVEAL, TARGET_COUNT_MS } from "@/app/vibe/reveal";
import { addBot, removeBot, botsOf, humansOf } from "@/lib/bots";
import { PlayerPanel } from "@/app/vibe/PlayerPanel";

export default function VibePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("vibe", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [botErr, setBotErr] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  // Display only: play the reveal if this phone saw it start, else show the end state.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  const rounds = (room?.rounds ?? []) as VibeRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as VibePhaseData;
  const me = players.find((p) => p.id === playerId);

  if (error)
    return (
      <Shell title="Vibe Check" icon="🌡️">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/vibe/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Vibe Check" icon="🌡️">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/vibe/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const target = phaseData.target ?? 0;
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const myBullseye =
    !!myResult && !myResult.isPsychic && myResult.guess != null && Math.abs(myResult.guess - target) <= BULLSEYE;

  return (
    <Shell title={`Vibe Check · ${me.name}`} icon="🌡️">
      {room.phase === "lobby" && (
        <LobbyWait
          me={me}
          players={players}
          note={
            <p className="text-fog text-sm">
              {humansOf(players).length} player
              {humansOf(players).length === 1 ? "" : "s"}
              {botsOf(players).length > 0 && ` + ${botsOf(players).length} bot${
                botsOf(players).length === 1 ? "" : "s"
              }`}
            </p>
          }
        >
          {/* The people actually playing should set the table size, not
              whoever happens to be holding the host screen. */}
          <div className="flex items-center gap-3 w-full max-w-xs mt-2">
            <button
              onClick={async () => setBotErr(await addBot(room, players))}
              className="flex-1 rounded-xl border-2 border-line py-2.5 font-bold hover:border-glow"
            >
              🤖 Add a bot
            </button>
            {botsOf(players).length > 0 && (
              <button
                onClick={async () => setBotErr(await removeBot(players))}
                className="rounded-xl border border-line px-4 py-2.5 text-fog hover:border-lose"
              >
                Remove
              </button>
            )}
          </div>
          {botErr && <p className="text-lose text-sm">{botErr}</p>}
        </LobbyWait>
      )}

      {(room.phase === "clue" || room.phase === "guess") && playerId && (
        <PlayerPanel room={room} players={players} subs={subs} playerId={playerId} />
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4" style={EDGE_CLIP}>
            <div className="neon-panel p-4 text-center">
              <div className="text-fog text-sm">“{phaseData.clue}” lived at</div>
              <div className="text-3xl font-extrabold">
                <RollingNumber
                  from={staged ? 0 : target}
                  value={target}
                  delayMs={REVEAL.target}
                  ms={TARGET_COUNT_MS}
                />
                /100
              </div>
              <div className="text-fog text-xs">
                {round.left} ← → {round.right}
              </div>
            </div>
            <Dial
              marks={(phaseData.results ?? [])
                .filter((r) => r.guess != null)
                .map((r) => ({
                  id: r.player_id,
                  pos: r.guess!,
                  label: r.player_id === playerId ? `${r.name} (you)` : r.name,
                  color: playerHue(r.player_id),
                }))}
              target={phaseData.target}
              left={round.left}
              right={round.right}
            />
            {myResult && (
              <ResultCard
                tone={myResult.gained > 0 ? "win" : "neutral"}
                points={myResult.gained}
                celebrate={myBullseye}
                delayMs={REVEAL.bullseye}
                title={
                  myResult.isPsychic
                    ? "Psychic bonus for dials near your spot"
                    : myResult.guess == null
                      ? "No dial in time"
                      : `Your dial: ${myResult.guess} (off by ${Math.abs(myResult.guess - target)})`
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
        <div style={EDGE_CLIP}>
          <FinalStandings players={players} highlightId={playerId} size="phone" staged={staged} />
        </div>
      )}
    </Shell>
  );
}
