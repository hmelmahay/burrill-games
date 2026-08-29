"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, shuffle, hostKey, joinRoom, playerKey } from "@/lib/rooms";
import { CHAIN_BANK } from "@/lib/content/chains";
import { ChainMode } from "@/app/chain/constants";

const MAX_CHAINS = 5;

export default function ChainHostSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ChainMode>("race");
  const [numChains, setNumChains] = useState(3);
  const [raceSeconds, setRaceSeconds] = useState(180);
  const [duelSeconds, setDuelSeconds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // A duel burns two chains per round (one per player), so always deal
    // enough for either mode; a race just uses the first numChains of them.
    const rounds = shuffle(CHAIN_BANK).slice(0, MAX_CHAINS * 2);
    const { room, error } = await createRoom("chain", rounds, {
      mode,
      numChains,
      raceSeconds,
      duelSeconds,
    });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    const n = name.trim();
    if (n) {
      const { player, error: jErr } = await joinRoom("chain", room.code, n);
      if (jErr || !player) {
        setErr(jErr ?? "Room made, but couldn't seat you as a player.");
        setBusy(false);
        return;
      }
      localStorage.setItem(playerKey(room.code), player.id);
    }
    router.push(`/chain/host/${room.code}`);
  }

  return (
    <Shell title="Chain Gang" icon="⛓️">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Chain Gang</h1>
        <p className="text-fog text-sm text-center -mt-3">
          FIRE → WORK → SHOP: every word pairs with the one before it. Ten words
          per chain — the first is free.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playing too? Enter your name"
            maxLength={20}
            autoComplete="off"
            className="rounded-lg border border-line bg-card px-3 py-2"
          />
          <span className="text-fog text-xs">
            Leave blank to run this screen as a scoreboard only.
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Mode</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("race")}
              className={`rounded-xl border-2 p-3 text-left ${
                mode === "race" ? "border-glow bg-glow/10" : "border-line"
              }`}
            >
              <span className="font-bold block">🏁 Race</span>
              <span className="text-fog text-xs">
                Everyone solves the same chain on their phone. First to finish
                it wins the round.
              </span>
            </button>
            <button
              onClick={() => setMode("duel")}
              className={`rounded-xl border-2 p-3 text-left ${
                mode === "duel" ? "border-glow bg-glow/10" : "border-line"
              }`}
            >
              <span className="font-bold block">⚔️ Duel</span>
              <span className="text-fog text-xs">
                Two players, each on their own chain, taking turns — first to
                the bottom of theirs wins.
              </span>
            </button>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Chains</span>
          <select
            value={numChains}
            onChange={(e) => setNumChains(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
        {mode === "race" && (
          <label className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              Time per chain
              <span className="block text-xs text-fog font-normal">
                The round ends early when someone finishes
              </span>
            </span>
            <select
              value={raceSeconds}
              onChange={(e) => setRaceSeconds(Number(e.target.value))}
              className="rounded-lg border border-line bg-card px-3 py-2"
            >
              <option value={120}>2 min</option>
              <option value={180}>3 min</option>
              <option value={240}>4 min</option>
            </select>
          </label>
        )}
        {mode === "duel" && (
          <label className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              Time per turn
              <span className="block text-xs text-fog font-normal">
                Clock runs out = a pass: your letter shows, turn swaps
              </span>
            </span>
            <select
              value={duelSeconds}
              onChange={(e) => setDuelSeconds(Number(e.target.value))}
              className="rounded-lg border border-line bg-card px-3 py-2"
            >
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
            </select>
          </label>
        )}
        <BigBtn onClick={start} disabled={busy}>
          {busy ? "Creating…" : "Create room"}
        </BigBtn>
        {err && <p className="text-lose text-sm text-center">{err}</p>}
      </div>
    </Shell>
  );
}
