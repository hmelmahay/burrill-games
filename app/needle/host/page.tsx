"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, Pool, Song, Pattern, Difficulty } from "@/lib/needle/types";
import { generateCode, shuffle } from "@/lib/needle/parsers";
import { generateCard } from "@/lib/needle/bingo";
import { DifficultyInfo } from "@/app/needle/DifficultyInfo";

const ALL_POOL_ID = "00000000-0000-0000-0000-000000000001";

export default function HostHome() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [songCounts, setSongCounts] = useState<Record<string, number>>({});
  const [allSongCount, setAllSongCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  // Launch-all settings
  const [clipSeconds, setClipSeconds] = useState(20);
  const [pattern, setPattern] = useState<Pattern>("line");
  const [difficulty, setDifficulty] = useState<Difficulty>("expert");

  async function load() {
    setLoading(true);
    const { data: poolData, error } = await supabase
      .from("pools")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);

    // Get song counts per pool
    const { data: songsData } = await supabase
      .from("songs")
      .select("pool_id,youtube_id");
    const counts: Record<string, number> = {};
    const allIds = new Set<string>();
    ((songsData as { pool_id: string; youtube_id: string }[]) ?? []).forEach((s) => {
      counts[s.pool_id] = (counts[s.pool_id] ?? 0) + 1;
      if (s.pool_id !== ALL_POOL_ID) allIds.add(s.youtube_id);
    });
    setSongCounts(counts);
    setAllSongCount(allIds.size);

    // Filter out the All Pools virtual pool from the display list
    setPools(((poolData ?? []) as Pool[]).filter((p) => p.id !== ALL_POOL_ID));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setErr(null);
    const { data, error } = await supabase
      .from("pools")
      .insert({ name: trimmed })
      .select()
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setName("");
    setPools((p) => [data as Pool, ...p]);
  }

  async function del(id: string) {
    if (!confirm("Delete this pool and all its songs?")) return;
    const { error } = await supabase.from("pools").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    setPools((p) => p.filter((x) => x.id !== id));
  }

  async function launchAll() {
    setErr(null);
    setLaunching(true);

    // Pull every song from every pool except the virtual All pool itself, dedupe by youtube_id
    const { data: songs, error: sErr } = await supabase
      .from("songs")
      .select("youtube_id,name,pool_id")
      .neq("pool_id", ALL_POOL_ID);
    if (sErr) {
      setErr(sErr.message);
      setLaunching(false);
      return;
    }
    const byId = new Map<string, { youtube_id: string; name: string }>();
    ((songs as Song[]) ?? []).forEach((s) => {
      if (!byId.has(s.youtube_id)) byId.set(s.youtube_id, { youtube_id: s.youtube_id, name: s.name });
    });
    const allSongs = Array.from(byId.values());
    if (allSongs.length < 24) {
      setErr(`Need at least 24 songs across all pools. You have ${allSongs.length}.`);
      setLaunching(false);
      return;
    }

    let code = "";
    let gameId = "";
    for (let i = 0; i < 8; i++) {
      code = generateCode(4);
      const playOrder = shuffle(allSongs.map((s) => s.youtube_id));
      const { data, error } = await supabase
        .from("games")
        .insert({
          code,
          pool_id: ALL_POOL_ID,
          clip_seconds: clipSeconds,
          pattern,
          difficulty,
          play_order: playOrder,
          called: [],
          status: "live",
        })
        .select()
        .single();
      if (!error && data) {
        gameId = (data as { id: string }).id;
        break;
      }
      if (error && error.code !== "23505") {
        setErr(error.message);
        setLaunching(false);
        return;
      }
    }
    if (!gameId) {
      setErr("Couldn't generate a unique game code. Try again.");
      setLaunching(false);
      return;
    }

    const cardRows = Array.from({ length: 12 }).map((_, i) => ({
      game_id: gameId,
      label: `C${i + 1}`,
      grid: generateCard(allSongs),
      claimed: false,
    }));
    const { error: cardErr } = await supabase.from("cards").insert(cardRows);
    if (cardErr) {
      setErr(cardErr.message);
      setLaunching(false);
      return;
    }
    router.push(`/needle/host/game/${code}`);
  }

  return (
    <main className="dark flex flex-1 flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pools</h1>
        <Link href="/" className="text-sm underline">
          home
        </Link>
      </div>

      <section className="rounded-2xl border-2 border-purple-500 bg-purple-50 dark:bg-purple-950/30 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🎲 Launch from ALL pools</h2>
          <span className="text-sm text-zinc-500">
            {allSongCount} unique songs
          </span>
        </div>
        <div className="flex gap-3 flex-wrap items-center text-sm">
          <label className="flex items-center gap-1">
            Clip:
            <select
              value={clipSeconds}
              onChange={(e) => setClipSeconds(Number(e.target.value))}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
            >
              <option value={15}>15s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Win:
            <select
              value={pattern}
              onChange={(e) => setPattern(e.target.value as Pattern)}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
            >
              <option value="line">Line</option>
              <option value="fourcorners">Four corners</option>
              <option value="blackout">Blackout</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Difficulty:
            <DifficultyInfo />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
            >
              <option value="expert">Expert</option>
              <option value="novice">Novice</option>
              <option value="beginner">Beginner</option>
            </select>
          </label>
          <button
            onClick={launchAll}
            disabled={launching || allSongCount < 24}
            className="rounded-lg bg-purple-600 text-white px-4 py-2 font-semibold disabled:opacity-40"
          >
            {launching ? "Launching…" : "Launch"}
          </button>
        </div>
      </section>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New pool name (e.g. Classic Rock)"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button
          onClick={create}
          className="rounded-lg bg-black dark:bg-white text-white dark:text-black px-4 font-semibold"
        >
          Create
        </button>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : pools.length === 0 ? (
        <p className="text-zinc-500">No pools yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pools.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4"
            >
              <Link href={`/needle/host/pool/${p.id}`} className="flex-1 font-medium">
                {p.name}
                <span className="ml-2 text-xs text-zinc-500">
                  ({songCounts[p.id] ?? 0} songs)
                </span>
              </Link>
              <button
                onClick={() => del(p.id)}
                className="text-red-600 text-sm px-2"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
