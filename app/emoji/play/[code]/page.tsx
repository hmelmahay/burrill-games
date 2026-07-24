"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase, EmojiRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { EmojiPhaseData } from "@/app/emoji/constants";

export default function EmojiPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("emoji", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setGuess("");
    setSent(false);
  }, [room?.round_idx]);

  const settings = (room?.settings ?? {}) as { guessSeconds?: number };
  const guessSeconds = settings.guessSeconds ?? 30;
  const round = room ? (room.rounds[room.round_idx] as EmojiRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as EmojiPhaseData;
  const me = players.find((p) => p.id === playerId);
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    guessSeconds,
    room?.phase === "guess",
  );

  async function submit() {
    if (!room || !playerId || mySub || sent || !guess.trim()) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { guess: guess.trim() },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (error)
    return (
      <Shell title="Emoji Cinema" icon="🎬">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/emoji/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Emoji Cinema" icon="🎬">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/emoji/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const locked = sent || !!mySub;

  return (
    <Shell title={`Emoji Cinema · ${me.name}`} icon="🎬">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <Countdown left={left} total={guessSeconds} />
          <div className="rounded-2xl bg-card border-2 border-violet p-6 text-center">
            <div className="text-5xl leading-tight tracking-wider">{round.emoji}</div>
            <div className="text-fog text-xs mt-2 uppercase tracking-widest">{round.kind}</div>
          </div>
          {!locked && left > 0 ? (
            <>
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Your guess…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={60}
                className="rounded-xl border-2 border-glow bg-card px-4 py-4 text-lg"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                onClick={submit}
                disabled={!guess.trim()}
                className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg disabled:opacity-40"
              >
                Lock it in
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              {locked ? (
                <>
                  <p className="font-bold text-xl">🔒 “{mySub ? String(mySub.payload.guess) : guess}”</p>
                  <p className="text-fog">Waiting for everyone…</p>
                </>
              ) : (
                <p className="text-fog text-xl">⏰ Time&apos;s up!</p>
              )}
            </div>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          {myResult && (
            <div
              className={`rounded-2xl p-6 text-center pop-in ${
                myResult.correct ? "bg-win text-[#03180b]" : "bg-lose text-white"
              }`}
            >
              <div className="text-3xl font-extrabold">
                {myResult.correct ? `+${myResult.gained}` : "✗"}
              </div>
              <div className="font-semibold">
                {round.emoji} = {round.answer}
              </div>
            </div>
          )}
          <Leaderboard players={players} highlightId={playerId} />
          <p className="text-fog text-sm text-center">Waiting for the host…</p>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-3xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} highlightId={playerId} />
          </div>
        </div>
      )}
    </Shell>
  );
}
