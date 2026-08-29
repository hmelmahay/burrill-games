"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { LetterRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { LetterBoard } from "@/app/letterrip/LetterBoard";
import { GuessPanel } from "@/app/letterrip/GuessPanel";
import {
  LetterSettings,
  LetterPhaseData,
  deriveBoard,
  teamOf,
  activeTeam,
  teamIds,
  TEAM_META,
} from "@/app/letterrip/constants";

export default function LetterRipPlay({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("letterrip", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as LetterSettings;
  const mode = settings.mode ?? "race";
  const boardSeconds = settings.boardSeconds ?? 60;
  const stealSeconds = settings.stealSeconds ?? 20;
  const totalBoards = Math.min(settings.numBoards ?? 6, room?.rounds.length ?? 0);
  const round = room
    ? (room.rounds[room.round_idx] as LetterRound | undefined)
    : undefined;
  const phaseData = (room?.phase_data ?? {}) as LetterPhaseData;
  const me = players.find((p) => p.id === playerId);

  const playerIds = players.map((p) => p.id);
  const atkTeam = activeTeam(room?.round_idx ?? 0);
  const defTeam = 1 - atkTeam;
  const teamOpts =
    mode === "teams"
      ? { solveIds: teamIds(playerIds, atkTeam), stealIds: teamIds(playerIds, defTeam) }
      : {};

  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const found = round ? deriveBoard(round, roundSubs, teamOpts) : [];

  const inGuessPhase = room?.phase === "solve" || room?.phase === "steal";
  const phaseSeconds = room?.phase === "steal" ? stealSeconds : boardSeconds;
  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    phaseSeconds,
    inGuessPhase,
  );

  if (error)
    return (
      <Shell title="Letter Rip" icon="🔤">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/letterrip/play">
          Back to join
        </Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Letter Rip" icon="🔤">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device.{" "}
            <Link className="underline" href="/letterrip/play">
              Join first.
            </Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const mySeat = players.findIndex((p) => p.id === me.id);
  const myTeam = mySeat >= 0 ? teamOf(mySeat) : null;
  const iCanGuess =
    mode !== "teams" ||
    (room.phase === "solve" ? myTeam === atkTeam : myTeam === defTeam);

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const foundCount = found.filter(Boolean).length;

  const teamScore = (team: number) =>
    players.reduce((sum, p, i) => (teamOf(i) === team ? sum + p.score : sum), 0);

  return (
    <Shell title={`Letter Rip · ${me.name}`} icon="🔤">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🔤</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          {mode === "teams" && myTeam != null && (
            <p className="font-bold">
              {TEAM_META[myTeam].dot} You&apos;re on {TEAM_META[myTeam].name}
            </p>
          )}
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm text-center">
            {mode === "race" &&
              "A category, six hidden answers — first letter and blanks are the only clues. Type an answer before anyone else to claim it."}
            {mode === "teams" &&
              "Your team races the clock on its boards; steal whatever the other side leaves behind."}
            {mode === "coop" &&
              "Everyone together — clear all six answers before time runs out."}
          </p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {inGuessPhase && round && (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Board {room.round_idx + 1}/{totalBoards}
            </span>
            <span>
              {foundCount}/{round.answers.length} found
            </span>
          </div>
          {/* Sticky with the same backdrop as the guess box: the clock stays
              on screen while the board scrolls between them. */}
          <div className="sticky top-0 z-10 -mx-1 rounded-b-xl bg-ink/95 px-1 pb-1.5 pt-1 backdrop-blur">
            <Countdown left={left} total={phaseSeconds} />
          </div>
          {mode === "teams" && (
            <p className="text-center text-sm font-bold pop-in">
              {room.phase === "steal"
                ? iCanGuess
                  ? "🔁 Steal time — grab what they missed!"
                  : "🔁 The other side is trying to steal…"
                : iCanGuess
                  ? `${TEAM_META[atkTeam].dot} Your team is up!`
                  : `${TEAM_META[atkTeam].dot} ${TEAM_META[atkTeam].name} is up — watch closely.`}
            </p>
          )}
          <LetterBoard
            round={round}
            found={found}
            players={players}
            highlightId={playerId}
          />
          <GuessPanel
            room={room}
            round={round}
            playerId={playerId!}
            subs={subs}
            phase={room.phase === "steal" ? "steal" : "solve"}
            found={found}
            disabled={!iCanGuess}
            disabledNote={
              room.phase === "steal"
                ? "Your side is done — hope they miss!"
                : "Not your board — your team is up next."
            }
          />
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained > 0
                  ? "bg-win text-[#03180b]"
                  : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="font-semibold">{myResult.detail}</div>
            </div>
          )}
          <h1 className="text-xl font-extrabold text-center">
            {phaseData.cleared ? "🧹 Board cleared!" : "⏰ Time!"}
          </h1>
          <LetterBoard
            round={round}
            found={phaseData.found ?? found}
            players={players}
            showAll
            highlightId={playerId}
          />
          {mode === "teams" && (
            <p className="text-center text-sm text-fog">
              {TEAM_META[0].dot} {teamScore(0)} · {TEAM_META[1].dot}{" "}
              {teamScore(1)}
            </p>
          )}
          <Leaderboard players={players} gains={gains} highlightId={playerId} />
          <p className="text-fog text-sm text-center">Waiting for the host…</p>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-3xl font-extrabold">🏆 Final standings</h1>
          {mode === "teams" && (
            <p className="text-lg font-bold text-center">
              {teamScore(0) === teamScore(1)
                ? "It's a tie!"
                : teamScore(0) > teamScore(1)
                  ? `${TEAM_META[0].dot} ${TEAM_META[0].name} wins ${teamScore(0)}–${teamScore(1)}!`
                  : `${TEAM_META[1].dot} ${TEAM_META[1].name} wins ${teamScore(1)}–${teamScore(0)}!`}
            </p>
          )}
          {mode === "coop" && phaseData.tally && (
            <p className="text-lg font-bold text-center">
              🤝 Together you cleared {phaseData.tally.boards}/{totalBoards}{" "}
              boards and found {phaseData.tally.answers} answers!
            </p>
          )}
          <div className="w-full">
            <Leaderboard players={players} highlightId={playerId} />
          </div>
        </div>
      )}
    </Shell>
  );
}
