"use client";

import { useRef, useState, use, useEffect } from "react";
import { supabase, EmojiRound } from "@/lib/supabase";
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
import { guessMatches } from "@/lib/matching";
import {
  BASE_POINTS,
  SPEED_BONUS,
  LATE_BONUS,
  EmojiPhaseData,
  EmojiResult,
} from "@/app/emoji/constants";

export default function EmojiHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("emoji", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number; guessSeconds?: number };
  const guessSeconds = settings.guessSeconds ?? 30;
  const totalRounds = Math.min(settings.numRounds ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as EmojiRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as EmojiPhaseData;
  const answered = subs.filter((s) => s.round_idx === room?.round_idx);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    guessSeconds,
    room?.phase === "guess",
  );

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "guess", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function reveal() {
    if (!room || !round || room.phase !== "guess") return;
    if (revealingRef.current === room.round_idx) return;
    revealingRef.current = room.round_idx;
    setBusy(true);

    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx)
      .order("created_at", { ascending: true });
    const rows = (subRows ?? []) as { player_id: string; payload: { guess?: string } }[];

    let rank = 0;
    const results: EmojiResult[] = players.map((p) => ({
      player_id: p.id,
      name: p.name,
      gained: 0,
      correct: false,
      guess: rows.find((r) => r.player_id === p.id)?.payload.guess ?? null,
    }));
    for (const r of rows) {
      const res = results.find((x) => x.player_id === r.player_id);
      if (!res || !r.payload.guess) continue;
      if (guessMatches(r.payload.guess, round.answer, round.alts)) {
        res.correct = true;
        res.gained = BASE_POINTS + (SPEED_BONUS[rank] ?? LATE_BONUS);
        rank++;
      }
    }

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

  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "guess" && players.length > 0 && answered.length >= players.length) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered.length, players.length, room?.phase]);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalRounds;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "guess", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Emoji Cinema" icon="🎬"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Emoji Cinema" icon="🎬"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title="Emoji Cinema · host" icon="🎬">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Emoji Cinema → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 1}>
            {players.length < 1 ? "Waiting for players…" : `Start (${totalRounds} puzzles)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Puzzle {room.round_idx + 1}/{totalRounds} · {round.kind}
            </span>
            <span>
              {answered.length}/{players.length} guessed
            </span>
          </div>
          <Countdown left={left} total={guessSeconds} />
          <div className="rounded-2xl bg-card border-2 border-violet p-8 text-center">
            <div className="text-6xl leading-tight tracking-wider">{round.emoji}</div>
          </div>
          <p className="text-fog text-center text-sm">
            It&apos;s a {round.kind.toLowerCase()} — type your guess on your phone!
          </p>
          <BigBtn onClick={reveal} disabled={busy} color={left === 0 ? "glow" : "ghost"}>
            {left === 0 ? "Time! Reveal answer" : "Reveal early"}
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Puzzle {room.round_idx + 1}/{totalRounds}
          </p>
          <div className="rounded-2xl bg-card border-2 border-win p-6 text-center">
            <div className="text-4xl">{round.emoji}</div>
            <div className="text-2xl font-extrabold mt-2">{round.answer}</div>
          </div>
          <div className="rounded-xl bg-card border border-line p-3 text-sm flex flex-col gap-1">
            {(phaseData.results ?? []).map((r) => (
              <div key={r.player_id} className="flex justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className={`truncate flex-1 text-right ${r.correct ? "text-win" : "text-fog"}`}>
                  {r.guess ?? "—"} {r.correct ? "✓" : ""}
                </span>
              </div>
            ))}
          </div>
          <Leaderboard players={players} gains={gains} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= totalRounds ? "Finish game" : "Next puzzle"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <a href="/emoji/host" className="underline text-fog">
            Play again with a new room
          </a>
        </div>
      )}
    </Shell>
  );
}
