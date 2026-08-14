"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, Player } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips } from "@/app/components/ui";
import { shuffle, playerKey } from "@/lib/rooms";
import { WordGrid } from "@/app/chameleon/WordGrid";
import { PlayerPanel } from "@/app/chameleon/PlayerPanel";
import { CHAMELEON_TOPICS } from "@/lib/content/chameleon";
import {
  ESCAPE_POINTS,
  CAUGHT_BUT_GUESSED_POINTS,
  CATCHERS_POINTS,
  ChamRound,
  ChamResult,
  ChamPhaseData,
} from "@/app/chameleon/constants";

export default function ChameleonHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("chameleon", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const advancingRef = useRef<string | null>(null);

  // Set when whoever opened this screen also joined as a player.
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  useEffect(() => {
    setMyPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);
  const iAmPlaying = !!myPlayerId && players.some((p) => p.id === myPlayerId);

  const settings = (room?.settings ?? {}) as { roundCount?: number };
  const rounds = (room?.rounds ?? []) as ChamRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as ChamPhaseData;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const votes = roundSubs.filter(
    (s) => (s.payload as { vote?: string }).vote != null,
  );
  const chamGuessSub = roundSubs.find(
    (s) =>
      s.player_id === round?.chameleon_id &&
      (s.payload as { guess?: number }).guess != null,
  );

  async function startGame() {
    if (!room) return;
    setBusy(true);
    const roundCount = settings.roundCount ?? 5;
    const topics = shuffle(CHAMELEON_TOPICS);
    const order: ChamRound[] = [];
    // Deal chameleon turns from a reshuffled deck of players so nobody gets
    // it twice before everyone's had it once.
    let deck: Player[] = [];
    for (let i = 0; i < roundCount; i++) {
      if (deck.length === 0) deck = shuffle(players);
      const cham = deck.pop()!;
      const t = topics[i % topics.length];
      order.push({
        chameleon_id: cham.id,
        chameleon_name: cham.name,
        topic: t.topic,
        words: t.words,
        secret_idx: Math.floor(Math.random() * t.words.length),
        order: shuffle(players).map((p) => p.name),
      });
    }
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "clue", round_idx: 0, rounds: order, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function openVote() {
    if (!room || room.phase !== "clue") return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ phase: "vote", phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  // Count the vote. Unique top target = the accused; a tie means the room
  // couldn't agree and the chameleon slips away.
  async function tally() {
    if (!room || !round || room.phase !== "vote") return;
    const key = `tally-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    setBusy(true);

    const counts: Record<string, number> = {};
    for (const v of votes) {
      const t = (v.payload as { vote?: string }).vote;
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }
    const max = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    const accused = max > 0 && leaders.length === 1 ? leaders[0] : null;
    const caught = accused === round.chameleon_id;

    if (caught) {
      await supabase
        .from("arcade_rooms")
        .update({ phase: "guess", phase_data: { votes: counts, accused_id: accused, caught } })
        .eq("id", room.id);
      setBusy(false);
      return;
    }

    const results: ChamResult[] = players.map((p) => ({
      player_id: p.id,
      name: p.name,
      gained: p.id === round.chameleon_id ? ESCAPE_POINTS : 0,
      wasChameleon: p.id === round.chameleon_id,
    }));
    await scoreAndReveal(results, { votes: counts, accused_id: accused, caught, guess_idx: null });
    setBusy(false);
  }

  async function scoreAndReveal(results: ChamResult[], data: ChamPhaseData) {
    if (!room) return;
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
      .update({ phase: "reveal", phase_data: { ...data, results } })
      .eq("id", room.id);
  }

  // Everyone has voted → tally without waiting on the host.
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "vote" && players.length > 0 && votes.length >= players.length) {
      tally();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes.length, players.length, room?.phase]);

  // The caught chameleon picked a word → score the round.
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || !round || room.phase !== "guess" || !chamGuessSub) return;
    const key = `guess-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    const guessIdx = (chamGuessSub.payload as { guess?: number }).guess ?? -1;
    const correct = guessIdx === round.secret_idx;
    const results: ChamResult[] = players.map((p) => {
      const isCham = p.id === round.chameleon_id;
      return {
        player_id: p.id,
        name: p.name,
        gained: isCham
          ? correct
            ? CAUGHT_BUT_GUESSED_POINTS
            : 0
          : correct
            ? 0
            : CATCHERS_POINTS,
        wasChameleon: isCham,
      };
    });
    scoreAndReveal(results, { ...phaseData, guess_idx: guessIdx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamGuessSub?.id, room?.phase]);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= rounds.length;
    advancingRef.current = null;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "clue", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Chameleon" icon="🦎"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Chameleon" icon="🦎"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const accused = players.find((p) => p.id === phaseData.accused_id);

  return (
    <Shell title="Chameleon · host" icon="🦎">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} game="chameleon" />
          <p className="text-center text-fog text-sm">
            Players join at this site → Chameleon → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <p className="text-fog text-xs text-center">
            Clues are spoken out loud, so this one is humans-only — best with 4+
            in the same room.
          </p>
          <BigBtn onClick={startGame} disabled={busy || players.length < 3}>
            {players.length < 3
              ? "Need at least 3 players…"
              : `Start (${settings.roundCount ?? 5} rounds)`}
          </BigBtn>
        </div>
      )}

      {iAmPlaying && myPlayerId && room.phase !== "lobby" && room.phase !== "reveal" && room.phase !== "gameover" && (
        <div className="mb-5 rounded-2xl border-2 border-violet bg-card/60 p-4">
          <PlayerPanel room={room} players={players} subs={subs} playerId={myPlayerId} conceal />
        </div>
      )}

      {room.phase === "clue" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length}
          </p>
          <div className="rounded-2xl bg-card border-2 border-glow p-4 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">Topic</div>
            <div className="text-2xl font-extrabold">{round.topic}</div>
          </div>
          <WordGrid words={round.words} />
          <p className="text-fog text-sm text-center">
            Check your phone for your role. One of you is the Chameleon 🦎 — then
            go around out loud, one clue word each:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {round.order.map((n, i) => (
              <span key={i} className="rounded-full bg-card border border-line px-3 py-1.5 text-sm font-semibold">
                {i + 1}. {n}
              </span>
            ))}
          </div>
          <BigBtn onClick={openVote} disabled={busy}>
            Everyone&apos;s spoken → start the vote
          </BigBtn>
        </div>
      )}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length} · {votes.length}/{players.length} votes in
          </p>
          <div className="rounded-2xl bg-card border-2 border-lose p-5 text-center">
            <div className="text-3xl">🗳️</div>
            <div className="text-xl font-extrabold">Who is the Chameleon?</div>
            <p className="text-fog text-sm mt-1">Vote on your phones. Ties let the Chameleon escape!</p>
          </div>
          <WordGrid words={round.words} />
          <BigBtn onClick={tally} disabled={busy || votes.length === 0} color="ghost">
            Close the vote now ({votes.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4 items-center py-4">
          <p className="text-4xl">🦎</p>
          <h1 className="text-2xl font-extrabold text-center">
            {round.chameleon_name} was the Chameleon — caught!
          </h1>
          <p className="text-fog text-sm text-center">
            One way out: they&apos;re picking what they think the secret word was.
            Guess right and they still score.
          </p>
          <WordGrid words={round.words} />
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length} · topic: {round.topic}
          </p>
          <div
            className={`rounded-2xl border-2 p-5 text-center ${
              phaseData.caught && phaseData.guess_idx !== round.secret_idx
                ? "border-win bg-win/10"
                : "border-lose bg-lose/10"
            }`}
          >
            <div className="text-3xl">🦎</div>
            <div className="text-xl font-extrabold">
              {round.chameleon_name} was the Chameleon
            </div>
            <p className="text-sm mt-1">
              {!phaseData.caught
                ? phaseData.accused_id
                  ? `The room accused ${accused?.name ?? "someone else"} — the Chameleon escapes! +${ESCAPE_POINTS}`
                  : `The vote tied — the Chameleon escapes! +${ESCAPE_POINTS}`
                : phaseData.guess_idx === round.secret_idx
                  ? `Caught — but guessed “${round.words[round.secret_idx]}” right! +${CAUGHT_BUT_GUESSED_POINTS}`
                  : `Caught, and guessed “${round.words[phaseData.guess_idx ?? 0] ?? "…"}” — wrong! Everyone else +${CATCHERS_POINTS}`}
            </p>
          </div>
          <WordGrid
            words={round.words}
            highlightIdx={round.secret_idx}
            pickedIdx={
              phaseData.guess_idx != null && phaseData.guess_idx !== round.secret_idx
                ? phaseData.guess_idx
                : null
            }
          />
          {phaseData.votes && (
            <div className="flex flex-wrap justify-center gap-2">
              {players
                .filter((p) => (phaseData.votes?.[p.id] ?? 0) > 0)
                .sort((a, b) => (phaseData.votes?.[b.id] ?? 0) - (phaseData.votes?.[a.id] ?? 0))
                .map((p) => (
                  <span key={p.id} className="rounded-full bg-card border border-line px-3 py-1.5 text-sm">
                    {p.name}: {phaseData.votes?.[p.id]} vote{(phaseData.votes?.[p.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                ))}
            </div>
          )}
          <Leaderboard players={players} gains={gains} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= rounds.length ? "Finish game" : "Next round"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <Link href="/chameleon/host" className="underline text-fog">
            Play again with a new room
          </Link>
        </div>
      )}
    </Shell>
  );
}
