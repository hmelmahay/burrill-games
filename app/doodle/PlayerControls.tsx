"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Sub } from "@/lib/supabase";
import { guessMatches } from "@/lib/matching";
import { PeekGuard, useMaskedTyping } from "@/app/components/ui";
import { DoodleRound } from "@/app/doodle/constants";

// A player's controls around the shared canvas: the artist picks a word, the
// guessers type. Shared by the phone view and the host screen, so whoever runs
// the room can play on the same device. (The canvas itself stays with each
// page — one canvas per screen, or two would fight over the stroke channel.)
// `conceal` is for the host screen, which others can see.

export function WordPicker({
  room,
  playerId,
  conceal,
}: {
  room: Room;
  playerId: string;
  conceal?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const round = (room.rounds as DoodleRound[])[room.round_idx];

  // Same artist two rounds running (turns per artist = 2) keeps this mounted.
  useEffect(() => {
    setPicking(false);
  }, [room.round_idx]);

  async function pickWord(w: string) {
    if (picking) return;
    setPicking(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { word: w },
    });
    if (e && e.code !== "23505") setPicking(false);
  }

  if (!round) return null;
  const options = (
    <div className="flex flex-col gap-3">
      {round.options.map((w, i) => (
        <button
          key={w}
          onClick={() => pickWord(w)}
          disabled={picking}
          className={`rounded-xl p-5 font-bold text-lg border-2 active:scale-95 transition ${
            i === 2 ? "border-violet bg-violet/15" : "border-line bg-card"
          }`}
        >
          {w}
          {i === 2 && <span className="block text-xs text-fog font-normal">trickier</span>}
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-extrabold text-center">
        🖌️ Your turn! Pick something to draw:
      </h1>
      {conceal ? (
        <PeekGuard key={room.round_idx} label="Tap to see your words">
          {options}
        </PeekGuard>
      ) : (
        options
      )}
    </div>
  );
}

type Saver = { subId: string | null; all: string[]; chain: Promise<void> };
const freshSaver = (): Saver => ({ subId: null, all: [], chain: Promise.resolve() });

export function GuessBox({
  room,
  subs,
  playerId,
  word,
  conceal,
}: {
  room: Room;
  subs: Sub[];
  playerId: string;
  word: string | undefined;
  conceal?: boolean;
}) {
  const [guess, setGuess] = useState("");
  const [myGuesses, setMyGuesses] = useState<string[]>([]);
  const { inputClass, toggle } = useMaskedTyping(conceal);
  // Saves run one at a time and always write the whole list, so a quick second
  // guess can't race the first insert and get dropped (or be overwritten by
  // an older list) while the screen already says "You got it".
  const saverRef = useRef<Saver>(freshSaver());

  useEffect(() => {
    setGuess("");
    setMyGuesses([]);
    saverRef.current = freshSaver();
  }, [room.round_idx]);

  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const iGotIt =
    !!word &&
    myGuesses
      .concat((mySub?.payload as { guesses?: string[] } | undefined)?.guesses ?? [])
      .some((g) => guessMatches(g, word));

  // Resolves true once the whole list is stored.
  async function save(saver: Saver, roomId: string, roundIdx: number): Promise<boolean> {
    if (!saver.subId) {
      const { data, error: e } = await supabase
        .from("arcade_subs")
        .insert({
          room_id: roomId,
          player_id: playerId,
          round_idx: roundIdx,
          payload: { guesses: saver.all },
        })
        .select("id")
        .single();
      if (data) {
        saver.subId = (data as { id: string }).id;
        return true;
      }
      if (e?.code !== "23505") return false;
      // This seat already has a row this round (say, from before a refresh):
      // keep its earlier guesses and carry on updating that row.
      const { data: row } = await supabase
        .from("arcade_subs")
        .select("id, payload")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .eq("round_idx", roundIdx)
        .maybeSingle();
      if (!row) return false;
      const existing = row as { id: string; payload: { guesses?: string[] } };
      saver.subId = existing.id;
      const earlier = (existing.payload.guesses ?? []).filter((g) => !saver.all.includes(g));
      saver.all = [...earlier, ...saver.all];
    }
    const { error: uErr } = await supabase
      .from("arcade_subs")
      .update({ payload: { guesses: saver.all } })
      .eq("id", saver.subId);
    return !uErr;
  }

  // A dropped save would leave "You got it" on screen with no points, so try
  // a couple more times before giving up on it.
  async function saveWithRetry(saver: Saver, roomId: string, roundIdx: number) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
      if (saver !== saverRef.current) return; // the round moved on
      if (await save(saver, roomId, roundIdx).catch(() => false)) return;
    }
  }

  function sendGuess() {
    const g = guess.trim();
    if (!g || iGotIt) return;
    setGuess("");
    const saver = saverRef.current;
    saver.all = [...saver.all, g];
    setMyGuesses(saver.all);
    const roomId = room.id;
    const roundIdx = room.round_idx;
    saver.chain = saver.chain.then(() => saveWithRetry(saver, roomId, roundIdx));
  }

  if (iGotIt)
    return (
      <div className="rounded-xl bg-win text-[#03180b] p-3 text-center font-bold pop-in">
        ✓ You got it! Don&apos;t say it out loud.
      </div>
    );

  return (
    <>
      <div className="flex gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="What is it?"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={40}
          className={`min-w-0 flex-1 rounded-xl border-2 border-glow bg-card px-4 py-3 ${inputClass}`}
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
      {myGuesses.length > 0 && !conceal && (
        <p className="text-fog text-xs">Tried: {myGuesses.slice(-4).join(" · ")}</p>
      )}
      {toggle}
    </>
  );
}
