"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, MajorityRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips } from "@/app/components/ui";
import { addBot, removeBot, humansOf, botsOf, botSkill, crowdBias, botBinaryVote, botPredict } from "@/lib/bots";
import { useBotSubmissions } from "@/lib/useBots";
import {
  PREDICT_POINTS,
  TIE_POINTS,
  MajorityPhaseData,
  MajorityResult,
} from "@/app/majority/constants";

export default function MajorityHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("majority", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number };
  const totalRounds = Math.min(settings.numRounds ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as MajorityRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as MajorityPhaseData;
  const answered = subs.filter((s) => s.round_idx === room?.round_idx);
  const [botErr, setBotErr] = useState<string | null>(null);

  // One shared leaning per prompt so bot votes cluster like real taste —
  // otherwise predicting the room would be a coin flip.
  const bias = round ? crowdBias(`${round.a}|${round.b}`) : 0.5;
  useBotSubmissions({
    room,
    players,
    roundSubs: answered,
    active: room?.phase === "vote" && !!round,
    tvRef,
    makePayload: (bot) => ({
      vote: botBinaryVote(bias),
      pred: botPredict(bias, botSkill(bot.id)),
    }),
  });

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "vote", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function reveal() {
    if (!room || !round || room.phase !== "vote") return;
    if (revealingRef.current === room.round_idx) return;
    revealingRef.current = room.round_idx;
    setBusy(true);

    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx);
    const rows = (subRows ?? []) as {
      player_id: string;
      payload: { vote?: "a" | "b"; pred?: "a" | "b" };
    }[];

    let aCount = 0;
    let bCount = 0;
    rows.forEach((r) => {
      if (r.payload.vote === "a") aCount++;
      if (r.payload.vote === "b") bCount++;
    });
    const majority: "a" | "b" | "tie" =
      aCount === bCount ? "tie" : aCount > bCount ? "a" : "b";

    const results: MajorityResult[] = players.map((p) => {
      const sub = rows.find((r) => r.player_id === p.id);
      const vote = sub?.payload.vote ?? null;
      const pred = sub?.payload.pred ?? null;
      let gained = 0;
      if (sub) {
        if (majority === "tie") gained = TIE_POINTS;
        else if (pred === majority) gained = PREDICT_POINTS;
      }
      return { player_id: p.id, name: p.name, gained, vote, pred };
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
      .update({ phase: "reveal", phase_data: { aCount, bCount, majority, results } })
      .eq("id", room.id);
    setBusy(false);
  }

  // Auto-reveal when everyone has voted. (TV copies must never do this.)
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "vote" && players.length > 0 && answered.length >= players.length) {
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
          : { phase: "vote", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Majority Rules" icon="🐑"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Majority Rules" icon="🐑"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const totalVotes = (phaseData.aCount ?? 0) + (phaseData.bCount ?? 0);
  const aPct = totalVotes ? Math.round(((phaseData.aCount ?? 0) / totalVotes) * 100) : 0;

  return (
    <Shell title="Majority Rules · host" icon="🐑">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} game="majority" />
          <p className="text-center text-fog text-sm">
            Players join at this site → Majority Rules → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => setBotErr(room ? await addBot(room, players) : null)}
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
          {botErr && <p className="text-lose text-sm text-center">{botErr}</p>}
          <BigBtn
            onClick={startGame}
            disabled={busy || players.length < 2 || humansOf(players).length < 1}
          >
            {players.length < 2
              ? "Need at least 2 players (bots count)…"
              : humansOf(players).length < 1
                ? "Need at least 1 human…"
                : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds} · {answered.length}/{players.length} voted
          </p>
          <h1 className="text-2xl font-extrabold text-center">Which one, room?</h1>
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl bg-glow text-[#1a1000] p-5 text-center font-bold text-xl">
              {round.a}
            </div>
            <div className="text-center text-fog font-bold">vs</div>
            <div className="rounded-xl bg-violet text-white p-5 text-center font-bold text-xl">
              {round.b}
            </div>
          </div>
          <p className="text-fog text-sm text-center">
            Everyone votes on their phone and predicts the majority.
          </p>
          <BigBtn onClick={reveal} disabled={busy || answered.length === 0} color="ghost">
            Reveal now ({answered.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds}
          </p>
          <div className="rounded-2xl bg-card border border-line p-4 flex flex-col gap-2">
            <div className="flex justify-between font-bold">
              <span className="text-glow">{round.a}</span>
              <span className="text-violet">{round.b}</span>
            </div>
            <div className="h-6 rounded-full overflow-hidden flex bg-line">
              <div className="bg-glow h-full transition-all" style={{ width: `${aPct}%` }} />
              <div className="bg-violet h-full flex-1" />
            </div>
            <div className="flex justify-between text-sm text-fog">
              <span>
                {phaseData.aCount ?? 0} votes ({aPct}%)
              </span>
              <span>{phaseData.bCount ?? 0} votes</span>
            </div>
            <p className="text-center font-extrabold text-xl mt-1">
              {phaseData.majority === "tie"
                ? "🤝 Dead tie! Everyone scores."
                : `Majority: ${phaseData.majority === "a" ? round.a : round.b}`}
            </p>
          </div>
          <Leaderboard players={players} gains={gains} />
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
          <Link href="/majority/host" className="underline text-fog">
            Play again with a new room
          </Link>
        </div>
      )}
    </Shell>
  );
}
