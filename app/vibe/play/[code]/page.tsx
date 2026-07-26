"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { VibeRound, VibePhaseData } from "@/app/vibe/constants";
import { Dial, MARK_COLORS } from "@/app/vibe/Dial";

export default function VibePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("vibe", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [clue, setClue] = useState("");
  const [dial, setDial] = useState(50);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setClue("");
    setDial(50);
    setSent(false);
  }, [room?.round_idx]);

  const rounds = (room?.rounds ?? []) as VibeRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as VibePhaseData;
  const me = players.find((p) => p.id === playerId);
  const isPsychic = round?.psychic_id === playerId;
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );
  const locked = sent || !!mySub;

  async function sendClue() {
    if (!room || !playerId || locked || !clue.trim()) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { clue: clue.trim() },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  async function sendGuess() {
    if (!room || !playerId || locked || isPsychic) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { guess: dial },
    });
    if (e && e.code !== "23505") setSent(false);
  }

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

  return (
    <Shell title={`Vibe Check · ${me.name}`} icon="🌡️">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "clue" && round && isPsychic && !locked && (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-extrabold text-center">🔮 You&apos;re the psychic!</h1>
          <div className="flex justify-between text-lg font-bold">
            <span>← {round.left}</span>
            <span>{round.right} →</span>
          </div>
          <div className="relative h-6 rounded-full bg-gradient-to-r from-violet to-glow">
            <div
              className="absolute top-[-6px] bottom-[-6px] w-2 bg-win rounded"
              style={{ left: `calc(${round.target}% - 4px)` }}
            />
          </div>
          <p className="text-fog text-sm text-center">
            The secret spot is at the green line ({round.target}/100). Write a clue that
            points there — without saying the scale words.
          </p>
          <input
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            placeholder="Your clue… (e.g. 'leftover pizza')"
            maxLength={60}
            autoComplete="off"
            className="rounded-xl border-2 border-glow bg-card px-4 py-4 text-lg"
            onKeyDown={(e) => e.key === "Enter" && sendClue()}
          />
          <button
            onClick={sendClue}
            disabled={!clue.trim()}
            className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg disabled:opacity-40"
          >
            Send clue
          </button>
        </div>
      )}

      {room.phase === "clue" && round && isPsychic && locked && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">📡</p>
          <p className="font-bold text-xl">Clue sent!</p>
        </div>
      )}

      {room.phase === "clue" && round && !isPsychic && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">🔮</p>
          <p className="font-bold text-xl">{round.psychic_name} is tuning in…</p>
        </div>
      )}

      {room.phase === "guess" && round && isPsychic && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">👀</p>
          <p className="font-bold text-xl">They&apos;re reading your mind…</p>
          <p className="text-fog text-sm">+150 for every dial that lands near your spot.</p>
        </div>
      )}

      {room.phase === "guess" && round && !isPsychic && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-glow p-4 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">
              {round.psychic_name}&apos;s clue
            </div>
            <div className="text-xl font-extrabold">“{phaseData.clue}”</div>
          </div>
          <div className="flex justify-between font-bold">
            <span>← {round.left}</span>
            <span>{round.right} →</span>
          </div>
          {!locked ? (
            <>
              <input
                type="range"
                min={0}
                max={100}
                value={dial}
                onChange={(e) => setDial(Number(e.target.value))}
                className="w-full h-10 accent-[#ff9f1c]"
              />
              <div className="text-center font-mono text-3xl font-bold">{dial}</div>
              <button
                onClick={sendGuess}
                className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg"
              >
                Lock in {dial}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="font-bold text-2xl font-mono">
                🔒 {(mySub?.payload as { guess?: number } | undefined)?.guess ?? dial}
              </p>
              <p className="text-fog">Waiting for everyone…</p>
            </div>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-win p-4 text-center">
            <div className="text-fog text-sm">“{phaseData.clue}” lived at</div>
            <div className="text-3xl font-extrabold">{phaseData.target}/100</div>
            <div className="text-fog text-xs">
              {round.left} ← → {round.right}
            </div>
          </div>
          <Dial
            marks={(phaseData.results ?? [])
              .filter((r) => r.guess != null)
              .map((r, i) => ({
                pos: r.guess!,
                label: r.player_id === playerId ? `${r.name} (you)` : r.name,
                color: MARK_COLORS[i % MARK_COLORS.length],
              }))}
            target={phaseData.target}
            left={round.left}
            right={round.right}
          />
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="text-sm">
                {myResult.isPsychic
                  ? "Psychic bonus for dials near your spot"
                  : myResult.guess == null
                    ? "No dial in time"
                    : `Your dial: ${myResult.guess} (off by ${Math.abs(
                        (myResult.guess ?? 0) - (phaseData.target ?? 0),
                      )})`}
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
