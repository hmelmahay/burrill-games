"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { supabase, Game, Card, Song } from "@/lib/needle/types";
import { checkWin } from "@/lib/needle/bingo";
import { YouTubePlayer, YouTubePlayerHandle } from "@/app/needle/YouTubePlayer";
import { useSpectator } from "@/lib/useSpectator";

export default function HostGame({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { tv, tvRef } = useSpectator();
  const [game, setGame] = useState<Game | null>(null);
  const [songsById, setSongsById] = useState<
    Record<string, { name: string; preview: string | null }>
  >({});
  const [cards, setCards] = useState<Card[]>([]);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [unplayableMsg, setUnplayableMsg] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [gapSeconds, setGapSeconds] = useState(3);
  // Per-device flag. The Mac mini stays as the audio device (true);
  // a phone toggled false becomes a remote control with no playback.
  const [isAudioDevice, setIsAudioDevice] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(`needle-audio-${code}`);
    if (stored === "false") setIsAudioDevice(false);
    if (stored === "true") setIsAudioDevice(true);
  }, [code]);
  function toggleAudioDevice() {
    setIsAudioDevice((v) => {
      const next = !v;
      try {
        localStorage.setItem(`needle-audio-${code}`, String(next));
      } catch {}
      if (!next) {
        // Stop any playing audio when becoming a remote control.
        stopAll();
      }
      return next;
    });
  }
  // Manual mode: app doesn't play audio, host taps songs as they hear them on Spotify/whatever.
  const [manualMode, setManualMode] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(`needle-manual-${code}`) === "true") {
      setManualMode(true);
    }
  }, [code]);
  function toggleManualMode() {
    setManualMode((v) => {
      const next = !v;
      try {
        localStorage.setItem(`needle-manual-${code}`, String(next));
      } catch {}
      if (next) stopAll();
      return next;
    });
  }
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoplayRef = useRef(false);
  autoplayRef.current = autoplay;
  const isAudioDeviceRef = useRef(true);
  isAudioDeviceRef.current = isAudioDevice;
  // Track which song we've already played locally so Realtime echoes don't replay.
  const lastPlayedRef = useRef<string | null>(null);
  // Ref to the latest nextSong so the autoplay timer doesn't fire a stale closure.
  const nextSongRef = useRef<() => void | Promise<void>>(() => {});

  // Browsers block timer-driven audio.play() until the element has played inside
  // a user gesture once. Priming with a silent clip on a click unlocks it, so
  // autoplayed preview songs are allowed to make sound.
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
  function unlockAudio() {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (a.dataset.unlocked) return;
    a.muted = true;
    a.src = SILENT_WAV;
    a.play()
      .then(() => {
        a.pause();
        a.muted = false;
        a.dataset.unlocked = "1";
      })
      .catch(() => {
        a.muted = false;
      });
  }

  // Unified playback: Apple preview clips play via <audio>; everything else via YouTube.
  function stopAudio() {
    if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
    audioTimerRef.current = null;
    try {
      audioRef.current?.pause();
    } catch {}
  }

  function stopAll() {
    stopAudio();
    playerRef.current?.stop();
  }

  function playKey(id: string, seconds: number) {
    const info = songsById[id];
    if (info?.preview) {
      playerRef.current?.stop();
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      stopAudio();
      const playSecs = Math.min(seconds, 30); // previews are 30s
      a.src = info.preview;
      a.currentTime = 0;
      a.play()
        .then(() => {
          a.dataset.unlocked = "1"; // a successful play means the element is unlocked
          setAudioBlocked(false);
        })
        .catch(() => setAudioBlocked(true));
      audioTimerRef.current = setTimeout(() => {
        try {
          a.pause();
        } catch {}
      }, playSecs * 1000);
      startCountdown(playSecs);
    } else {
      stopAudio();
      playerRef.current?.play(id, seconds);
      startCountdown(seconds);
    }
  }

  function clearAutoplayTimer() {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }

  function scheduleAutoplay(delayMs: number) {
    clearAutoplayTimer();
    autoplayTimerRef.current = setTimeout(() => {
      autoplayTimerRef.current = null;
      if (autoplayRef.current) {
        nextSongRef.current();
      }
    }, delayMs);
  }

  async function handleUnplayable(badId: string) {
    setUnplayableMsg(
      `"${songsById[badId]?.name ?? badId}" failed to play. Skipped (kept in pool — use 🗑 to delete if it's actually bad).`,
    );
    if (!game) return;
    // Remove from THIS GAME's called + play_order so we move past it,
    // but DO NOT delete from the pool. iOS fires onError for non-embed
    // reasons too (gesture block, mute switch), and we don't want to
    // delete good songs by mistake.
    const newCalled = game.called.filter((c) => c !== badId);
    const newOrder = game.play_order.filter((c) => c !== badId);
    await supabase
      .from("games")
      .update({ called: newCalled, play_order: newOrder })
      .eq("id", game.id);
    setGame({ ...game, called: newCalled, play_order: newOrder });
    if (tickRef.current) clearInterval(tickRef.current);
    setCountdown(0);
    if (autoplayRef.current) {
      scheduleAutoplay(1000);
    }
  }

  async function load() {
    const { data: g } = await supabase
      .from("games")
      .select("*")
      .eq("code", code)
      .single();
    if (!g) return;
    setGame(g as Game);
    const [{ data: songs }, { data: cardRows }] = await Promise.all([
      supabase
        .from("songs")
        .select("*")
        .in("youtube_id", (g as Game).play_order),
      supabase.from("cards").select("*").eq("game_id", (g as Game).id),
    ]);
    const map: Record<string, { name: string; preview: string | null }> = {};
    ((songs as Song[]) ?? []).forEach(
      (s) => (map[s.youtube_id] = { name: s.name, preview: s.preview_url ?? null }),
    );
    setSongsById(map);
    setCards((cardRows as Card[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [code]);

  // Audio-device responder: when called list grows (via local OR remote),
  // play the new last item if this device is the designated audio output.
  // A TV scoreboard copy must stay silent and passive.
  useEffect(() => {
    if (tvRef.current) return;
    if (!game || !isAudioDevice) return;
    const last = game.called[game.called.length - 1];
    if (!last || last === lastPlayedRef.current) return;
    lastPlayedRef.current = last;
    playKey(last, game.clip_seconds);
  }, [game?.called.length, isAudioDevice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: watch our game row and cards (for claims).
  useEffect(() => {
    if (!game) return;
    const ch = supabase
      .channel(`host-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `code=eq.${code}`,
        },
        (payload) => setGame((g) => (g ? ({ ...g, ...payload.new } as Game) : g)),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cards",
          filter: `game_id=eq.${game.id}`,
        },
        (payload) =>
          setCards((cs) =>
            cs.map((c) =>
              c.id === (payload.new as Card).id ? ({ ...c, ...payload.new } as Card) : c,
            ),
          ),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [game?.id, code]);

  const calledSet = new Set(game?.called ?? []);
  const nextId =
    game?.play_order.find((id) => !calledSet.has(id)) ?? null;
  const lastCalled = game?.called[game.called.length - 1];

  function nextSong() {
    if (!game || !nextId) return;
    const idToPlay = nextId;
    const clipSeconds = game.clip_seconds;
    // Only play locally if this device is the designated audio device.
    if (isAudioDeviceRef.current) {
      playKey(idToPlay, clipSeconds);
      lastPlayedRef.current = idToPlay;
    }
    const newCalled = [...game.called, idToPlay];
    setGame({ ...game, called: newCalled });
    if (autoplayRef.current) {
      // +3s buffer only for YouTube songs (pre-roll/loading); previews start instantly.
      const buffer = songsById[idToPlay]?.preview ? 0 : 3;
      scheduleAutoplay((clipSeconds + gapSeconds + buffer) * 1000);
    }
    supabase
      .from("games")
      .update({ called: newCalled })
      .eq("id", game.id)
      .then(({ error }) => {
        if (error) console.error("nextSong update failed:", error.message);
      });
  }
  // Keep ref pointing at latest nextSong so the autoplay timer never fires a stale closure.
  nextSongRef.current = nextSong;

  function markCalled(id: string) {
    if (!game) return;
    if (game.called.includes(id)) return;
    const newCalled = [...game.called, id];
    setGame({ ...game, called: newCalled });
    supabase
      .from("games")
      .update({ called: newCalled })
      .eq("id", game.id)
      .then(({ error }) => {
        if (error) console.error("markCalled update failed:", error.message);
      });
  }

  function replay() {
    if (!game || !lastCalled) return;
    playKey(lastCalled, game.clip_seconds);
  }

  async function skipLast() {
    if (!game || game.called.length === 0) return;
    clearAutoplayTimer();
    setAutoplay(false);
    const newCalled = game.called.slice(0, -1);
    const { error } = await supabase
      .from("games")
      .update({ called: newCalled })
      .eq("id", game.id);
    if (error) {
      alert(error.message);
      return;
    }
    setGame({ ...game, called: newCalled });
    stopAll();
    if (tickRef.current) clearInterval(tickRef.current);
    setCountdown(0);
  }

  async function deleteCurrent() {
    if (!game || !lastCalled) return;
    const name = songsById[lastCalled]?.name ?? lastCalled;
    if (!confirm(`Delete "${name}" from the pool? It'll be removed from this game and the pool permanently.`)) return;
    const badId = lastCalled;
    const newCalled = game.called.filter((c) => c !== badId);
    const newOrder = game.play_order.filter((c) => c !== badId);
    await supabase
      .from("games")
      .update({ called: newCalled, play_order: newOrder })
      .eq("id", game.id);
    setGame({ ...game, called: newCalled, play_order: newOrder });
    stopAll();
    if (tickRef.current) clearInterval(tickRef.current);
    setCountdown(0);
    await supabase.from("songs").delete().eq("youtube_id", badId);
  }

  function startCountdown(seconds: number) {
    if (tickRef.current) clearInterval(tickRef.current);
    setCountdown(seconds);
    const start = Date.now();
    tickRef.current = setInterval(() => {
      const left = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setCountdown(left);
      if (left <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, 250);
  }

  async function endGame() {
    if (!game) return;
    if (!confirm("End the game for everyone?")) return;
    setAutoplay(false);
    clearAutoplayTimer();
    await supabase.from("games").update({ status: "ended" }).eq("id", game.id);
    stopAll();
  }

  function toggleAutoplay() {
    const next = !autoplay;
    setAutoplay(next);
    if (!next) clearAutoplayTimer();
    // This click is a user gesture — unlock audio so the timer-driven plays
    // that autoplay relies on are allowed to make sound.
    if (next) unlockAudio();
  }

  // Cleanup autoplay on unmount
  useEffect(() => {
    return () => clearAutoplayTimer();
  }, []);

  if (!game)
    return (
      <main className="dark p-6">
        <p>Loading game…</p>
      </main>
    );

  const verifyCard = cards.find((c) => c.id === verifyId);
  const verifyResult = verifyCard
    ? checkWin(verifyCard.grid, game.called, game.pattern)
    : null;

  return (
    <main className={`dark flex flex-1 flex-col gap-4 p-4 max-w-3xl mx-auto w-full ${tv ? "tv-mode" : ""}`}>
      <div className="flex items-baseline justify-between">
        <Link href="/needle/host" className="text-sm underline">
          ← Pools
        </Link>
        <span className="text-sm text-zinc-500">
          {game.status === "ended" ? "ENDED" : "live"} · {game.pattern}
        </span>
      </div>

      <div className="rounded-2xl border-2 border-black dark:border-white p-4 text-center">
        <div className="text-sm text-zinc-500 uppercase tracking-wider">
          Join code
        </div>
        <div className="text-6xl font-bold font-mono tracking-widest">
          {game.code}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleManualMode}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            manualMode
              ? "bg-indigo-600 text-white"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {manualMode ? "✅ Manual mode (Spotify etc.)" : "Manual mode OFF"}
        </button>
        {!manualMode && (
          <button
            onClick={toggleAudioDevice}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              isAudioDevice
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-100 border border-zinc-600"
            }`}
          >
            {isAudioDevice ? "🔊 Plays audio" : "📱 Remote only"}
          </button>
        )}
      </div>

      {!tv && !manualMode && isAudioDevice && (
        // Keep the YT player mounted for mixed pools, but only show it when a
        // YouTube-sourced song is actually the current one; Apple previews play
        // invisibly through an <audio> element.
        <div className={lastCalled && !songsById[lastCalled]?.preview ? "" : "hidden"}>
          <YouTubePlayer ref={playerRef} onUnplayable={handleUnplayable} />
        </div>
      )}

      {manualMode && (
        <div className="rounded-lg border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">
              Tap a song when you play it on Spotify
            </span>
            <span className="text-xs text-zinc-500">
              {game.called.length}/{game.play_order.length} called
            </span>
          </div>
          <input
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            placeholder="Filter…"
            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
          />
          <div className="grid grid-cols-1 gap-1 max-h-80 overflow-y-auto">
            {game.play_order
              .filter((id) => !game.called.includes(id))
              .map((id) => ({ id, name: songsById[id]?.name ?? id }))
              .filter((s) =>
                s.name.toLowerCase().includes(manualSearch.toLowerCase().trim()),
              )
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => markCalled(s.id)}
                  className="text-left rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900"
                >
                  {s.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {unplayableMsg && (
        <div className="rounded-lg bg-amber-100 dark:bg-amber-950 border border-amber-400 text-amber-900 dark:text-amber-200 p-2 text-sm flex items-center justify-between">
          <span>⚠️ {unplayableMsg} Hit Next.</span>
          <button
            onClick={() => setUnplayableMsg(null)}
            className="text-xs underline"
          >
            dismiss
          </button>
        </div>
      )}

      {audioBlocked && lastCalled && (
        <button
          onClick={() => playKey(lastCalled, game.clip_seconds)}
          className="rounded-lg bg-amber-400 text-black p-3 text-center font-bold"
        >
          🔊 The browser blocked the music — tap here to play
        </button>
      )}

      <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-zinc-500">Now playing</div>
          <div className="font-semibold">
            {lastCalled ? songsById[lastCalled]?.name ?? lastCalled : "—"}
          </div>
        </div>
        <div className="text-3xl font-mono">{countdown}s</div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 gap-3">
        <button
          onClick={toggleAutoplay}
          disabled={game.status === "ended"}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            autoplay
              ? "bg-purple-600 text-white"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {autoplay ? "▶ Autoplay ON" : "Autoplay OFF"}
        </button>
        <label className="text-xs flex items-center gap-1 text-zinc-500">
          Gap:
          <select
            value={gapSeconds}
            onChange={(e) => setGapSeconds(Number(e.target.value))}
            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5"
          >
            <option value={2}>2s</option>
            <option value={3}>3s</option>
            <option value={5}>5s</option>
            <option value={8}>8s</option>
            <option value={10}>10s</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={nextSong}
          disabled={!nextId || game.status === "ended"}
          className="rounded-lg bg-green-600 text-white py-4 font-semibold disabled:opacity-40"
        >
          Next song
        </button>
        <button
          onClick={replay}
          disabled={!lastCalled}
          className="rounded-lg bg-blue-600 text-white py-4 font-semibold disabled:opacity-40"
        >
          Replay clip
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={skipLast}
          disabled={!lastCalled}
          className="rounded-lg border-2 border-amber-500 text-amber-600 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ⤺ Skip / undo
        </button>
        <button
          onClick={deleteCurrent}
          disabled={!lastCalled}
          className="rounded-lg border-2 border-red-500 text-red-600 py-2 text-sm font-semibold disabled:opacity-40"
        >
          🗑 Delete this song
        </button>
      </div>
      <button
        onClick={endGame}
        disabled={game.status === "ended"}
        className="rounded-lg border border-red-600 text-red-600 py-2 text-sm disabled:opacity-40"
      >
        End game
      </button>

      <section>
        <h2 className="font-semibold mb-1">
          Verify a winner ({cards.filter((c) => c.claimed).length} cards claimed)
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setVerifyId(c.id)}
              className={`rounded border p-2 text-sm ${
                c.claimed
                  ? "border-black dark:border-white"
                  : "border-zinc-300 dark:border-zinc-700 opacity-50"
              } ${verifyId === c.id ? "bg-yellow-100 dark:bg-yellow-900" : ""}`}
            >
              <div className="font-bold">{c.label}</div>
              <div className="text-xs truncate">
                {c.player_name ?? "unclaimed"}
              </div>
            </button>
          ))}
        </div>
        {verifyCard && (
          <div className="mt-3 flex flex-col gap-2">
            <div
              className={`rounded p-2 font-bold text-center ${
                verifyResult
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {verifyCard.label} · {verifyCard.player_name ?? "unclaimed"} ·{" "}
              {verifyResult ? "WINNER ✓" : "not a win"}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {verifyCard.grid.map((cell, i) => {
                const isFree = "free" in cell;
                const lit = isFree || game.called.includes(cell.youtube_id);
                return (
                  <div
                    key={i}
                    className={`aspect-square text-[10px] p-1 flex items-center justify-center text-center rounded ${
                      lit
                        ? "bg-green-500 text-white"
                        : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                  >
                    {isFree ? "FREE" : cell.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-1">
          Called ({game.called.length}/{game.play_order.length})
        </h2>
        <ol className="text-sm space-y-0.5 list-decimal list-inside">
          {[...game.called].reverse().map((id, i) => (
            <li key={`${id}-${i}`}>{songsById[id]?.name ?? id}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
