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
import { judgeCellStates, JudgeOverride } from "@/lib/content/scatter";
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
  // Host overrules, keyed `${playerId}:${catIdx}`: "reject" tosses a scoring
  // answer, "accept" rescues a duplicate or wrong-letter one.
  const [overrides, setOverrides] = useState<Map<string, JudgeOverride>>(
    new Map(),
  );
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
    setOverrides(new Map());
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

  // Live cell states, shown in the judge grid AND used verbatim by scoring so
  // the host resolves duplicates before scoring instead of discovering the
  // cancellations one phase later. An "accept" overrule always scores (and its
  // answer still counts against unrescued twins); a "reject" always tosses.
  const cellStates = useMemo(() => {
    if (!round) return [] as CellState[][];
    return judgeCellStates(
      grid.map(({ player, answers }) => ({ id: player.id, answers })),
      round.letter,
      round.categories.length,
      overrides,
    );
  }, [grid, overrides, round]);

  // Tap to overrule the automatic call; tap again to restore it.
  function tapCell(playerId: string, catIdx: number, effective: CellState) {
    if (effective === "empty") return;
    const key = `${playerId}:${catIdx}`;
    setOverrides((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else if (effective === "ok") next.set(key, "reject");
      else next.set(key, "accept"); // dupe, invalid or rejected → rescue it
      return next;
    });
  }

  async function finishJudging() {
    if (!room || !round || room.phase !== "judge") return;
    if (scoringRef.current === room.round_idx) return;
    scoringRef.current = room.round_idx;
    setBusy(true);

    const results: ScatterResult[] = grid.map(({ player, answers }, pi) => {
      const cells = answers.map((a, ci) => ({ a, s: cellStates[pi][ci] }));
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
          <CodeBadge code={room.code} game="scatter" />
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
            Judging — tap an answer to overrule the call
          </h1>
          <p className="text-fog text-sm text-center">
            Letter {round.letter}. Duplicates cancel out live as you judge. Tap a
            duplicate or wrong-letter answer to accept it anyway, tap a good answer
            to reject it — tap again to undo. What you see here is exactly what
            scores.
          </p>
          {round.categories.map((cat, ci) => (
            <div key={ci} className="rounded-xl bg-card border border-line p-3">
              <h2 className="font-bold mb-2">{cat}</h2>
              <div className="flex flex-wrap gap-2">
                {grid.map(({ player, answers }, pi) => {
                  const a = answers[ci];
                  const s = cellStates[pi]?.[ci] ?? "empty";
                  const accepted = overrides.get(`${player.id}:${ci}`) === "accept";
                  const styles: Record<CellState, string> = {
                    empty: "opacity-30 border-line",
                    invalid: "opacity-40 border-line line-through",
                    dupe: "bg-glow/15 border-glow line-through",
                    rejected: "bg-lose/30 border-lose line-through",
                    ok: accepted
                      ? "bg-win/20 border-win"
                      : "border-line bg-ink",
                  };
                  const label: Record<CellState, string> = {
                    empty: "",
                    invalid: "wrong letter",
                    dupe: "duplicate",
                    rejected: "rejected",
                    ok: accepted ? "✓ accepted" : `+${POINTS_PER_ANSWER}`,
                  };
                  return (
                    <button
                      key={player.id}
                      onClick={() => tapCell(player.id, ci, s)}
                      disabled={s === "empty"}
                      className={`rounded-lg px-3 py-2 text-sm border text-left ${styles[s]}`}
                    >
                      <span className="block text-xs text-fog">{player.name}</span>
                      {a.trim() || "—"}
                      {label[s] && (
                        <span
                          className={`block text-xs ${
                            s === "ok"
                              ? "text-win"
                              : s === "dupe"
                                ? "text-glow"
                                : "text-fog"
                          }`}
                        >
                          {label[s]}
                        </span>
                      )}
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
