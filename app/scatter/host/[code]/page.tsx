"use client";

import { useMemo, useRef, useState, use, useEffect } from "react";
import { supabase, ScatterRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  PlayerChips,
} from "@/app/components/ui";
import { normalizeAnswer, startsWithLetter } from "@/lib/content/scatter";
import {
  POINTS_PER_ANSWER,
  ScatterPhaseData,
  ScatterResult,
  CellState,
} from "@/app/scatter/constants";

type SubRow = { player_id: string; payload: { answers?: string[] } };

export default function ScatterHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh } = useRoom("scatter", code);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<Set<string>>(new Set()); // `${playerId}:${catIdx}`
  const scoringRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number; roundSeconds?: number };
  const roundSeconds = settings.roundSeconds ?? 60;
  const totalRounds = room?.rounds.length ?? 0;
  const round = room ? (room.rounds[room.round_idx] as ScatterRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ScatterPhaseData;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx) as unknown as (SubRow & {
    round_idx: number;
  })[];

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    roundSeconds,
    room?.phase === "write",
  );

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "write", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function startJudging() {
    if (!room) return;
    setBusy(true);
    setRejected(new Set());
    await refresh(); // pick up any last-second submissions
    await supabase.from("arcade_rooms").update({ phase: "judge" }).eq("id", room.id);
    setBusy(false);
  }

  // Judging grid: per player per category, with auto-flags.
  const grid = useMemo(() => {
    if (!round) return [];
    return players.map((p) => {
      const sub = roundSubs.find((s) => s.player_id === p.id);
      const answers = sub?.payload.answers ?? [];
      return {
        player: p,
        answers: round.categories.map((_, ci) => answers[ci] ?? ""),
      };
    });
  }, [players, roundSubs, round]);

  function toggleReject(playerId: string, catIdx: number) {
    setRejected((prev) => {
      const next = new Set(prev);
      const key = `${playerId}:${catIdx}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function finishJudging() {
    if (!room || !round || room.phase !== "judge") return;
    if (scoringRef.current === room.round_idx) return;
    scoringRef.current = room.round_idx;
    setBusy(true);

    // Classify every cell, then cancel duplicates among the surviving answers.
    const states: CellState[][] = grid.map(({ player, answers }) =>
      answers.map((a, ci) => {
        if (!a.trim()) return "empty";
        if (!startsWithLetter(a, round.letter)) return "invalid";
        if (rejected.has(`${player.id}:${ci}`)) return "rejected";
        return "ok";
      }),
    );
    for (let ci = 0; ci < round.categories.length; ci++) {
      const counts = new Map<string, number>();
      grid.forEach(({ answers }, pi) => {
        if (states[pi][ci] === "ok") {
          const n = normalizeAnswer(answers[ci]);
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
      });
      grid.forEach(({ answers }, pi) => {
        if (states[pi][ci] === "ok" && (counts.get(normalizeAnswer(answers[ci])) ?? 0) > 1) {
          states[pi][ci] = "dupe";
        }
      });
    }

    const results: ScatterResult[] = grid.map(({ player, answers }, pi) => {
      const cells = answers.map((a, ci) => ({ a, s: states[pi][ci] }));
      const gained = cells.filter((c) => c.s === "ok").length * POINTS_PER_ANSWER;
      return { player_id: player.id, name: player.name, gained, cells };
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

    await supabase
      .from("arcade_rooms")
      .update({ phase: "reveal", phase_data: { results } })
      .eq("id", room.id);
    setBusy(false);
  }

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalRounds;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "write", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  // Reset the double-score guard when moving to a new round.
  useEffect(() => {
    if (room?.phase === "write") scoringRef.current = null;
  }, [room?.phase, room?.round_idx]);

  if (error) return <Shell title="Scatter Sprint" icon="📝"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Scatter Sprint" icon="📝"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title="Scatter Sprint · host" icon="📝">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Scatter Sprint → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 2}>
            {players.length < 2 ? "Need at least 2 players…" : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "write" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds} · {roundSubs.length}/{players.length} handed in
          </p>
          <Countdown left={left} total={roundSeconds} />
          <div className="rounded-2xl border-2 border-glow bg-card p-6 text-center">
            <div className="text-xs text-fog uppercase tracking-[0.3em]">The letter is</div>
            <div className="text-7xl font-extrabold text-glow">{round.letter}</div>
          </div>
          <ul className="rounded-xl bg-card border border-line divide-y divide-line">
            {round.categories.map((c) => (
              <li key={c} className="px-4 py-3 font-semibold">{c}</li>
            ))}
          </ul>
          <BigBtn onClick={startJudging} disabled={busy} color={left === 0 ? "glow" : "ghost"}>
            {left === 0 ? "Pencils down — judge answers" : "End round early"}
          </BigBtn>
        </div>
      )}

      {room.phase === "judge" && round && (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-extrabold text-center">
            Judging — tap an answer to reject it
          </h1>
          <p className="text-fog text-sm text-center">
            Letter {round.letter}. Greyed answers are auto-tossed (blank or wrong letter).
            Matching answers cancel out automatically at scoring.
          </p>
          {round.categories.map((cat, ci) => (
            <div key={ci} className="rounded-xl bg-card border border-line p-3">
              <h2 className="font-bold mb-2">{cat}</h2>
              <div className="flex flex-wrap gap-2">
                {grid.map(({ player, answers }) => {
                  const a = answers[ci];
                  const auto = !a.trim() || !startsWithLetter(a, round.letter);
                  const isRejected = rejected.has(`${player.id}:${ci}`);
                  return (
                    <button
                      key={player.id}
                      onClick={() => !auto && toggleReject(player.id, ci)}
                      disabled={auto}
                      className={`rounded-lg px-3 py-2 text-sm border text-left ${
                        auto
                          ? "opacity-30 border-line line-through"
                          : isRejected
                            ? "bg-lose/30 border-lose line-through"
                            : "border-line bg-ink"
                      }`}
                    >
                      <span className="block text-xs text-fog">{player.name}</span>
                      {a.trim() || "—"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <BigBtn onClick={finishJudging} disabled={busy}>
            Score this round
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds} scored · letter {round.letter}
          </p>
          <Leaderboard players={players} gains={gains} />
          <details className="rounded-xl bg-card border border-line p-3">
            <summary className="font-bold cursor-pointer">Answer breakdown</summary>
            <div className="mt-2 flex flex-col gap-3">
              {(phaseData.results ?? []).map((r) => (
                <div key={r.player_id}>
                  <h3 className="font-semibold text-sm">{r.name} · +{r.gained}</h3>
                  <ul className="text-sm text-fog">
                    {r.cells.map((cell, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className={cell.s === "ok" ? "" : "line-through opacity-60"}>
                          {round.categories[i]}: {cell.a || "—"}
                        </span>
                        <span>
                          {cell.s === "ok" && `+${POINTS_PER_ANSWER}`}
                          {cell.s === "dupe" && "duplicate"}
                          {cell.s === "invalid" && "wrong letter"}
                          {cell.s === "rejected" && "rejected"}
                          {cell.s === "empty" && ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= totalRounds ? "Finish game" : "Next round"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <a href="/scatter/host" className="underline text-fog">
            Play again with a new room
          </a>
        </div>
      )}
    </Shell>
  );
}
