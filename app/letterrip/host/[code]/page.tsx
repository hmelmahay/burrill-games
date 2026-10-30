"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { supabase, LetterRound, Player, Sub } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  PlayerChips,
} from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { LetterBoard } from "@/app/letterrip/LetterBoard";
import { GuessPanel } from "@/app/letterrip/GuessPanel";
import {
  LetterSettings,
  LetterPhaseData,
  LetterResult,
  NamedClaim,
  deriveBoard,
  slotPoints,
  teamOf,
  activeTeam,
  teamIds,
  TEAM_META,
} from "@/app/letterrip/constants";

export default function LetterRipHost({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("letterrip", code);
  const { tv, tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const stealingRef = useRef<number | null>(null);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as LetterSettings;
  const mode = settings.mode ?? "race";
  const boardSeconds = settings.boardSeconds ?? 60;
  const stealSeconds = settings.stealSeconds ?? 20;
  const totalBoards = Math.min(settings.numBoards ?? 6, room?.rounds.length ?? 0);
  const round = room
    ? (room.rounds[room.round_idx] as LetterRound | undefined)
    : undefined;
  const phaseData = (room?.phase_data ?? {}) as LetterPhaseData;

  const [playerId, setPlayerId] = useState<string | null>(null);
  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);
  const me = players.find((p) => p.id === playerId);
  const canPlay = !!me && !tv;

  // Teams are join order, alternating; the active team alternates per board.
  const playerIds = players.map((p) => p.id);
  const atkTeam = activeTeam(room?.round_idx ?? 0);
  const defTeam = 1 - atkTeam;
  const teamOpts =
    mode === "teams"
      ? { solveIds: teamIds(playerIds, atkTeam), stealIds: teamIds(playerIds, defTeam) }
      : {};

  // The live board, derived from this round's submissions — every screen
  // (host, phones, TV) computes the same claims from the same rows.
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const found = round ? deriveBoard(round, roundSubs, teamOpts) : [];
  const allFound = found.length > 0 && found.every(Boolean);

  const inGuessPhase = room?.phase === "solve" || room?.phase === "steal";
  const phaseSeconds = room?.phase === "steal" ? stealSeconds : boardSeconds;
  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    phaseSeconds,
    inGuessPhase,
  );

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "solve", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  // Score the board and reveal it. Fetches the round's subs fresh so a claim
  // that hasn't reached this tab yet still counts.
  async function scoreReveal() {
    if (!room || !round || !inGuessPhase) return;
    if (revealingRef.current === room.round_idx) return; // fire once per board
    revealingRef.current = room.round_idx;
    setBusy(true);
    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx);
    const claims = deriveBoard(round, (subRows ?? []) as Sub[], teamOpts);
    const named: (NamedClaim | null)[] = claims.map((c) =>
      c
        ? { ...c, name: players.find((p) => p.id === c.player_id)?.name ?? "?" }
        : null,
    );
    const results: LetterResult[] = players.map((p) => {
      let gained = 0;
      let solves = 0;
      let steals = 0;
      claims.forEach((c, i) => {
        if (c?.player_id !== p.id) return;
        gained += slotPoints(i);
        if (c.ph === "steal") steals++;
        else solves++;
      });
      return {
        player_id: p.id,
        name: p.name,
        gained,
        detail:
          `${solves} answer${solves === 1 ? "" : "s"}` +
          (steals ? ` · ${steals} steal${steals === 1 ? "" : "s"} 🔁` : ""),
      };
    });
    await Promise.all(
      results
        .filter((r) => r.gained > 0)
        .map((r) => {
          const p = players.find((x) => x.id === r.player_id);
          return supabase
            .from("arcade_players")
            .update({ score: (p?.score ?? 0) + r.gained })
            .eq("id", r.player_id);
        }),
    );
    const cleared = claims.every(Boolean);
    const prev = phaseData.tally ?? { answers: 0, boards: 0 };
    const tally = {
      answers: prev.answers + claims.filter(Boolean).length,
      boards: prev.boards + (cleared ? 1 : 0),
    };
    await supabase
      .from("arcade_rooms")
      .update({
        phase: "reveal",
        phase_data: { results, found: named, cleared, tally },
      })
      .eq("id", room.id);
    setBusy(false);
  }

  // Solve phase ends when the board is cleared, or when both clocks agree the
  // time is up (server-stamped start AND the local countdown — a host tab
  // opened mid-round can't cut it short). In teams mode a board with
  // leftovers goes to the other side's steal window first. TV copies never
  // run this.
  const deadlinePassed =
    left === 0 &&
    (!room?.phase_started_at ||
      Date.now() >=
        new Date(room.phase_started_at).getTime() + (phaseSeconds + 2) * 1000);

  async function endSolve() {
    if (!room) return;
    if (mode === "teams" && !allFound) {
      if (stealingRef.current === room.round_idx) return;
      stealingRef.current = room.round_idx;
      await supabase
        .from("arcade_rooms")
        .update({ phase: "steal" })
        .eq("id", room.id);
    } else {
      await scoreReveal();
    }
  }

  useEffect(() => {
    if (tvRef.current) return;
    if (!room || players.length === 0) return;
    if (room.phase === "solve" && (allFound || deadlinePassed)) endSolve();
    if (room.phase === "steal" && (allFound || deadlinePassed)) scoreReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFound, deadlinePassed, room?.phase]);

  // Background tabs throttle timers; force a render when fronted again so an
  // overdue reveal fires immediately (same pattern as Quiz Rush).
  const [, wake] = useState(0);
  useEffect(() => {
    const onWake = () => wake((n) => n + 1);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalBoards;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : {
              phase: "solve",
              round_idx: room.round_idx + 1,
              // Carry the running coop tally; everything else resets.
              phase_data: phaseData.tally ? { tally: phaseData.tally } : {},
            },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error)
    return (
      <Shell title="Letter Rip" icon="🔤">
        <p className="text-lose">{error}</p>
      </Shell>
    );
  if (!room)
    return (
      <Shell title="Letter Rip" icon="🔤">
        <p className="text-fog">Loading…</p>
      </Shell>
    );

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const canStart = mode === "teams" ? players.length >= 2 : players.length >= 1;

  const mySeat = players.findIndex((p) => p.id === playerId);
  const myTeam = mySeat >= 0 ? teamOf(mySeat) : null;
  const iCanGuess =
    canPlay &&
    (mode !== "teams" ||
      (room.phase === "solve" ? myTeam === atkTeam : myTeam === defTeam));

  const teamScore = (team: number) =>
    players.reduce((sum, p, i) => (teamOf(i) === team ? sum + p.score : sum), 0);

  const teamRoster = (team: number) => (
    <div className="flex-1 rounded-xl border border-line bg-card p-3">
      <p className="font-bold mb-2">
        {TEAM_META[team].dot} {TEAM_META[team].name}
      </p>
      <PlayerChips players={players.filter((_, i) => teamOf(i) === team)} />
    </div>
  );

  const teamBanner = inGuessPhase && mode === "teams" && (
    <p className="text-center font-bold pop-in">
      {room.phase === "solve" ? (
        <>
          {TEAM_META[atkTeam].dot} {TEAM_META[atkTeam].name} is up!
        </>
      ) : (
        <>
          🔁 Steal! {TEAM_META[defTeam].dot} {TEAM_META[defTeam].name}
          {" grabs what's left"}
        </>
      )}
    </p>
  );

  const foundCount = found.filter(Boolean).length;

  return (
    <Shell title="Letter Rip · host" icon="🔤">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} game="letterrip" />
          <p className="text-center text-fog text-sm">
            {mode === "race" &&
              "Free-for-all: six hidden answers per category — first letter and blanks are the only clues. First to type an answer claims it; lower on the board pays more."}
            {mode === "teams" &&
              "Two teams alternate boards. Your team races the clock, then whatever's left is up for steals by the other side."}
            {mode === "coop" &&
              "Everyone together: clear all six answers on every board before the clock runs out."}
          </p>
          {mode === "teams" && players.length > 0 ? (
            <div className="flex gap-3">
              {teamRoster(0)}
              {teamRoster(1)}
            </div>
          ) : (
            <div>
              <h2 className="font-bold mb-2">Players ({players.length})</h2>
              <PlayerChips players={players} />
            </div>
          )}
          <BigBtn onClick={startGame} disabled={busy || !canStart}>
            {!canStart
              ? mode === "teams"
                ? "Waiting for 2 players…"
                : "Waiting for a player…"
              : `Start (${totalBoards} board${totalBoards === 1 ? "" : "s"})`}
          </BigBtn>
        </div>
      )}

      {inGuessPhase && round && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Board {room.round_idx + 1}/{totalBoards}
            </span>
            <span>
              {foundCount}/{round.answers.length} found
            </span>
          </div>
          <Countdown left={left} total={phaseSeconds} />
          {teamBanner}
          <LetterBoard
            round={round}
            found={found}
            players={players}
            highlightId={playerId}
          />
          {canPlay && (
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
                  : `${TEAM_META[atkTeam].name} is up — your board is next.`
              }
            />
          )}
          {!tv && (
            <BigBtn
              onClick={room.phase === "steal" ? scoreReveal : endSolve}
              disabled={busy}
              color="ghost"
            >
              {room.phase === "steal" ? "End the steal now" : "End the round now"}
            </BigBtn>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Board {room.round_idx + 1}/{totalBoards}
          </p>
          <h1 className="text-2xl font-extrabold text-center">
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
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= totalBoards ? "Finish game" : "Next board"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          {mode === "teams" && (
            <p className="text-xl font-bold">
              {teamScore(0) === teamScore(1)
                ? "It's a tie!"
                : teamScore(0) > teamScore(1)
                  ? `${TEAM_META[0].dot} ${TEAM_META[0].name} wins ${teamScore(0)}–${teamScore(1)}!`
                  : `${TEAM_META[1].dot} ${TEAM_META[1].name} wins ${teamScore(1)}–${teamScore(0)}!`}
            </p>
          )}
          {mode === "coop" && phaseData.tally && (
            <p className="text-xl font-bold text-center">
              🤝 Together you cleared {phaseData.tally.boards}/{totalBoards}{" "}
              boards and found {phaseData.tally.answers} answers!
            </p>
          )}
          <div className="w-full">
            <Leaderboard players={players} highlightId={playerId} />
          </div>
          <Link href="/letterrip/host" className="underline text-fog">
            Play again with a new room
          </Link>
        </div>
      )}
    </Shell>
  );
}
