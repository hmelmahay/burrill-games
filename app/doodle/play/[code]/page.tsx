"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { guessMatches } from "@/lib/matching";
import { DoodleCanvas } from "@/app/doodle/DoodleCanvas";
import { DoodleRound, DoodlePhaseData } from "@/app/doodle/constants";

export default function DoodlePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh } = useRoom("doodle", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [myGuesses, setMyGuesses] = useState<string[]>([]);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setGuess("");
    setMyGuesses([]);
  }, [room?.round_idx]);

  const settings = (room?.settings ?? {}) as { drawSeconds?: number };
  const drawSeconds = settings.drawSeconds ?? 90;
  const rounds = (room?.rounds ?? []) as DoodleRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as DoodlePhaseData;
  const me = players.find((p) => p.id === playerId);
  const isDrawer = round?.drawer_id === playerId;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const mySub = roundSubs.find((s) => s.player_id === playerId);
  const drawerSub = roundSubs.find((s) => s.player_id === round?.drawer_id);
  const word = (drawerSub?.payload as { word?: string } | undefined)?.word;
  const iGotIt =
    !!word && myGuesses.concat((mySub?.payload as { guesses?: string[] })?.guesses ?? []).some((g) => guessMatches(g, word));

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    drawSeconds,
    room?.phase === "draw",
  );

  async function pickWord(w: string) {
    if (!room || !playerId || mySub) return;
    await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { word: w },
    });
  }

  async function sendGuess() {
    const g = guess.trim();
    if (!room || !playerId || !g || isDrawer || iGotIt) return;
    setGuess("");
    setMyGuesses((cur) => [...cur, g]);
    if (!mySub) {
      const { error: e } = await supabase.from("arcade_subs").insert({
        room_id: room.id,
        player_id: playerId,
        round_idx: room.round_idx,
        payload: { guesses: [g] },
      });
      if (e && e.code === "23505") {
        await refresh();
      }
    } else {
      const prev = (mySub.payload as { guesses?: string[] }).guesses ?? [];
      await supabase
        .from("arcade_subs")
        .update({ payload: { guesses: [...prev, g] } })
        .eq("id", mySub.id);
    }
  }

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

  return (
    <Shell title={`Doodle Dash · ${me.name}`} icon="🎨">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "pick" && round && isDrawer && (
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-extrabold text-center">
            🖌️ Your turn! Pick something to draw:
          </h1>
          {round.options.map((w, i) => (
            <button
              key={w}
              onClick={() => pickWord(w)}
              className={`rounded-xl p-5 font-bold text-lg border-2 active:scale-95 transition ${
                i === 2 ? "border-violet bg-violet/15" : "border-line bg-card"
              }`}
            >
              {w}
              {i === 2 && <span className="block text-xs text-fog font-normal">trickier</span>}
            </button>
          ))}
        </div>
      )}

      {room.phase === "pick" && round && !isDrawer && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">🖌️</p>
          <p className="font-bold text-xl">{round.drawer_name} is choosing a word…</p>
          <p className="text-fog text-sm">Fingers on keyboards.</p>
        </div>
      )}

      {room.phase === "draw" && round && (
        <div className="flex flex-col gap-3">
          <Countdown left={left} total={drawSeconds} />
          {isDrawer && (
            <div className="rounded-xl bg-violet/20 border border-violet p-3 text-center font-bold">
              Draw: <span className="uppercase tracking-wide">{word}</span>
            </div>
          )}
          <DoodleCanvas code={code} roundIdx={room.round_idx} canDraw={isDrawer} />
          {!isDrawer && !iGotIt && (
            <div className="flex gap-2">
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="What is it?"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={40}
                className="flex-1 rounded-xl border-2 border-glow bg-card px-4 py-3"
                onKeyDown={(e) => e.key === "Enter" && sendGuess()}
              />
              <button
                onClick={sendGuess}
                disabled={!guess.trim()}
                className="rounded-xl bg-glow text-[#1a1000] px-5 font-bold disabled:opacity-40"
              >
                Guess
              </button>
            </div>
          )}
          {!isDrawer && iGotIt && (
            <div className="rounded-xl bg-win text-[#03180b] p-3 text-center font-bold pop-in">
              ✓ You got it! Don&apos;t say it out loud.
            </div>
          )}
          {!isDrawer && myGuesses.length > 0 && !iGotIt && (
            <p className="text-fog text-xs">Tried: {myGuesses.slice(-4).join(" · ")}</p>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-win p-4 text-center">
            <div className="text-fog text-sm">It was</div>
            <div className="text-2xl font-extrabold uppercase">{phaseData.word}</div>
          </div>
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="text-sm">
                {myResult.isDrawer
                  ? "Artist royalties"
                  : myResult.correct
                    ? "Nice eye!"
                    : "It was right there…"}
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
