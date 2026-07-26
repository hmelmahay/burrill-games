"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Pool, Song, Pattern, Difficulty } from "@/lib/needle/types";
import { parseBulkSongs, parseYoutubeId, generateCode, shuffle } from "@/lib/needle/parsers";
import { generateCard } from "@/lib/needle/bingo";
import { DifficultyInfo } from "@/app/needle/DifficultyInfo";

type ITunesHit = {
  trackId: number;
  name: string;
  artist: string;
  previewUrl: string;
  artwork: string | null;
};

export default function PoolEditor({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);
  const router = useRouter();
  const [pool, setPool] = useState<Pool | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [paste, setPaste] = useState("");
  const [parseInfo, setParseInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // iTunes search
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ITunesHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [clipSeconds, setClipSeconds] = useState(20);
  const [pattern, setPattern] = useState<Pattern>("line");
  const [difficulty, setDifficulty] = useState<Difficulty>("expert");
  const [launching, setLaunching] = useState(false);

  async function load() {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("pools").select("*").eq("id", poolId).single(),
      supabase
        .from("songs")
        .select("*")
        .eq("pool_id", poolId)
        .order("created_at", { ascending: true }),
    ]);
    setPool(p as Pool | null);
    setSongs((s as Song[]) ?? []);
  }

  useEffect(() => {
    load();
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  // ---------- iTunes search ----------

  async function search() {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/itunes?term=${encodeURIComponent(term)}`);
      const data = (await res.json()) as { results: ITunesHit[] };
      setHits(data.results ?? []);
      if ((data.results ?? []).length === 0) setParseInfo("No matches found.");
    } catch {
      setErr("Search failed. Try again.");
    }
    setSearching(false);
  }

  function togglePreview(hit: ITunesHit) {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (previewing === hit.trackId) {
      a.pause();
      setPreviewing(null);
      return;
    }
    a.src = hit.previewUrl;
    a.currentTime = 0;
    a.play().catch(() => {});
    setPreviewing(hit.trackId);
    a.onended = () => setPreviewing(null);
  }

  async function addHit(hit: ITunesHit) {
    const key = `it_${hit.trackId}`;
    if (songs.some((s) => s.youtube_id === key)) {
      setParseInfo(`"${hit.name}" is already in the pool.`);
      return;
    }
    const { data, error } = await supabase
      .from("songs")
      .insert({
        pool_id: poolId,
        name: hit.name,
        artist: hit.artist,
        youtube_id: key,
        preview_url: hit.previewUrl,
      })
      .select()
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setSongs((cur) => [...cur, data as Song]);
    setParseInfo(`Added "${hit.name}" — ${hit.artist}.`);
  }

  // ---------- bulk add (plain song names, or YouTube URLs as before) ----------

  async function addBulk() {
    setErr(null);
    setParseInfo(null);
    const lines = paste.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    // Lines containing a YouTube URL/id keep the classic route; the rest get looked up.
    const ytLines: string[] = [];
    const nameLines: string[] = [];
    for (const line of lines) {
      const candidate = line.includes("|") ? line.split("|").pop()!.trim() : line;
      const looksLikeYt =
        /youtu\.?be|youtube\.com/i.test(candidate) ||
        (/^[A-Za-z0-9_-]{11}$/.test(candidate) && /[0-9_-]/.test(candidate));
      if (looksLikeYt && parseYoutubeId(candidate)) {
        ytLines.push(line);
      } else {
        nameLines.push(line);
      }
    }

    const existing = new Set(songs.map((s) => s.youtube_id));
    const toInsert: {
      pool_id: string;
      name: string;
      artist?: string | null;
      youtube_id: string;
      preview_url?: string | null;
    }[] = [];
    const failures: string[] = [];

    const { rows } = parseBulkSongs(ytLines.join("\n"));
    for (const r of rows) {
      if (!existing.has(r.youtube_id)) {
        toInsert.push({ pool_id: poolId, name: r.name, youtube_id: r.youtube_id });
        existing.add(r.youtube_id);
      }
    }

    // Resolve plain names via iTunes, gently paced for Apple's rate limit.
    for (let i = 0; i < nameLines.length; i++) {
      setParseInfo(`Looking up ${i + 1}/${nameLines.length}: ${nameLines[i]}…`);
      try {
        const res = await fetch(`/api/itunes?term=${encodeURIComponent(nameLines[i])}`);
        const data = (await res.json()) as { results: ITunesHit[] };
        const hit = (data.results ?? [])[0];
        if (!hit) {
          failures.push(nameLines[i]);
        } else {
          const key = `it_${hit.trackId}`;
          if (!existing.has(key)) {
            toInsert.push({
              pool_id: poolId,
              name: hit.name,
              artist: hit.artist,
              youtube_id: key,
              preview_url: hit.previewUrl,
            });
            existing.add(key);
          }
        }
      } catch {
        failures.push(nameLines[i]);
      }
      if (i < nameLines.length - 1) await new Promise((r) => setTimeout(r, 350));
    }

    if (toInsert.length === 0) {
      setParseInfo(
        failures.length
          ? `Nothing added. Couldn't find: ${failures.join(", ")}`
          : "Nothing new to add.",
      );
      return;
    }
    const { data, error } = await supabase.from("songs").insert(toInsert).select();
    if (error) {
      setErr(error.message);
      return;
    }
    setSongs((cur) => [...cur, ...((data as Song[]) ?? [])]);
    setPaste("");
    setParseInfo(
      `Added ${data?.length ?? 0}.${
        failures.length ? ` Couldn't find: ${failures.join(", ")}.` : ""
      }`,
    );
  }

  async function removeSong(id: string) {
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    setSongs((curr) => curr.filter((s) => s.id !== id));
  }

  function previewSong(s: Song) {
    if (!s.preview_url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.src = s.preview_url;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  async function launch() {
    if (songs.length < 24) {
      setErr(`Need at least 24 songs to launch. You have ${songs.length}.`);
      return;
    }
    setErr(null);
    setLaunching(true);

    let code = "";
    let gameId = "";
    for (let i = 0; i < 8; i++) {
      code = generateCode(4);
      const playOrder = shuffle(songs.map((s) => s.youtube_id));
      const { data, error } = await supabase
        .from("games")
        .insert({
          code,
          pool_id: poolId,
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
      grid: generateCard(
        songs.map((s) => ({ youtube_id: s.youtube_id, name: s.name })),
      ),
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
        <Link href="/needle/host" className="text-sm underline">
          ← Pools
        </Link>
        <span className="text-sm text-zinc-500">{songs.length} songs</span>
      </div>
      <h1 className="text-3xl font-bold">{pool?.name ?? "…"}</h1>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-purple-500 bg-purple-50 dark:bg-purple-950/30 p-4">
        <h2 className="font-semibold">🔎 Search songs (no links needed)</h2>
        <p className="text-sm text-zinc-500">
          Type a song or artist. Clips play as ad-free 30-second previews from Apple.
        </p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. sweet caroline"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3"
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button
            onClick={search}
            disabled={searching}
            className="rounded-lg bg-purple-600 text-white px-4 font-semibold disabled:opacity-40"
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {hits.map((h) => (
              <li
                key={h.trackId}
                className="flex items-center gap-3 p-2.5 bg-white dark:bg-zinc-900"
              >
                {h.artwork ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.artwork} alt="" className="w-10 h-10 rounded" />
                ) : (
                  <div className="w-10 h-10 rounded bg-zinc-200 dark:bg-zinc-800" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{h.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{h.artist}</div>
                </div>
                <button
                  onClick={() => togglePreview(h)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
                >
                  {previewing === h.trackId ? "⏸" : "▶"}
                </button>
                <button
                  onClick={() => addHit(h)}
                  className="rounded-lg bg-black dark:bg-white text-white dark:text-black px-3 py-2 text-sm font-semibold"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Bulk add</h2>
        <p className="text-sm text-zinc-500">
          One per line. Plain song names get looked up automatically —{" "}
          <code>sweet caroline</code> works. YouTube links still work too.
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={6}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 font-mono text-sm"
          placeholder={"sweet caroline\ndancing queen\nmr brightside"}
        />
        <div className="flex gap-2 items-center">
          <button
            onClick={addBulk}
            className="rounded-lg bg-black dark:bg-white text-white dark:text-black px-4 py-2 font-semibold"
          >
            Add songs
          </button>
          {parseInfo && <span className="text-sm text-zinc-500">{parseInfo}</span>}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Launch game</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <label className="text-sm flex items-center gap-2">
            Clip length:
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
          <label className="text-sm flex items-center gap-2">
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
          <label className="text-sm flex items-center gap-2">
            Difficulty:
            <DifficultyInfo />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
            >
              <option value="expert">Expert (no help)</option>
              <option value="novice">Novice (3 strikes)</option>
              <option value="beginner">Beginner (auto-mark)</option>
            </select>
          </label>
          <button
            onClick={launch}
            disabled={launching || songs.length < 24}
            className="rounded-lg bg-green-600 text-white px-4 py-2 font-semibold disabled:opacity-40"
          >
            {launching ? "Launching…" : "Launch"}
          </button>
        </div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">Songs</h2>
        {songs.length === 0 ? (
          <p className="text-zinc-500">No songs yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {songs.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-zinc-900"
              >
                <span className="flex-1 truncate">
                  {s.name}
                  {s.artist && (
                    <span className="text-zinc-500 text-sm"> — {s.artist}</span>
                  )}
                </span>
                {s.preview_url ? (
                  <button
                    onClick={() => previewSong(s)}
                    className="text-xs rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1"
                    title="Play preview"
                  >
                    ▶ preview
                  </button>
                ) : (
                  <a
                    href={`https://youtu.be/${s.youtube_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-500"
                  >
                    {s.youtube_id}
                  </a>
                )}
                <button
                  onClick={() => removeSong(s.id)}
                  className="text-red-600 text-sm"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
