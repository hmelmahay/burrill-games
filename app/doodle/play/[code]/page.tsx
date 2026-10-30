"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { LobbyWait, ResultCard, Reveal, RevealScope } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { playerKey } from "@/lib/rooms";
import { useStaged } from "@/lib/motion";
import { DoodleCanvas } from "@/app/doodle/DoodleCanvas";
import { WordPicker, GuessBox } from "@/app/doodle/PlayerControls";
import { DoodleRound, DoodlePhaseData } from "@/app/doodle/constants";
import { REVEAL, firstGuesser } from "@/app/doodle/reveal";

export default function DoodlePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("doodle", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as { drawSeconds?: number };
  const drawSeconds = settings.drawSeconds ?? 90;
  const rounds = (room?.rounds ?? []) as DoodleRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as DoodlePhaseData;
  const me = players.find((p) => p.id === playerId);
  const isDrawer = round?.drawer_id === playerId;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const drawerSub = roundSubs.find((s) => s.player_id === round?.drawer_id);
  const word = (drawerSub?.payload as { word?: string } | undefined)?.word;

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    drawSeconds,
    room?.phase === "draw",
  );
  // Same timing as the host screen; a refreshed phone gets the final state.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  if (error)
    return (
      <Shell title="Doodle Dash" icon="🎨">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/doodle/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Doodle Dash" icon="🎨">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/doodle/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const first = firstGuesser(phaseData.results ?? []);
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title={`Doodle Dash · ${me.name}`} icon="🎨">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "pick" && round && isDrawer && playerId && (
        <WordPicker room={room} playerId={playerId} />
      )}

      {room.phase === "pick" && round && !isDrawer && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">🖌️</p>
          <p className="font-bold text-xl">{round.drawer_name} is choosing a word…</p>
          <p className="text-fog text-sm">Fingers on keyboards.</p>
        </div>
      )}

      {/* no-enter: nothing above the canvas may carry a transform, or strokes
          land off the finger while it plays. */}
      {room.phase === "draw" && round && (
        <div className="no-enter flex flex-col gap-3">
          <Countdown left={left} total={drawSeconds} />
          {isDrawer && (
            <div className="rounded-xl bg-violet/20 border border-violet p-3 text-center font-bold">
              Draw: <span className="uppercase tracking-wide">{word}</span>
            </div>
          )}
          {/* A still frame only: never animate the canvas or its parents. */}
          <div className="neon-panel p-2">
            <DoodleCanvas code={code} roundIdx={room.round_idx} canDraw={isDrawer} />
          </div>
          {!isDrawer && playerId && (
            <GuessBox room={room} subs={subs} playerId={playerId} word={word} />
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <div className="neon-panel p-4 text-center">
              <div className="text-fog text-sm">It was</div>
              <Reveal
                kind="neon-on"
                delayMs={REVEAL.word}
                className="font-display neon-text mt-1 text-2xl uppercase break-words"
              >
                {phaseData.word}
              </Reveal>
            </div>
            {myResult && (
              <ResultCard
                tone={myResult.gained > 0 ? "win" : "neutral"}
                points={myResult.gained}
                title={
                  myResult.isDrawer
                    ? "Artist royalties"
                    : myResult.correct
                      ? "Nice eye!"
                      : "It was right there…"
                }
                celebrate={!!first && first.player_id === playerId}
                delayMs={REVEAL.word}
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
