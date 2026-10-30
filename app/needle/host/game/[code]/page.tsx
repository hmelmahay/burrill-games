"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { supabase, Game, Card, Song, Pattern } from "@/lib/needle/types";
import { checkWin } from "@/lib/needle/bingo";
import { claimCard, needleCardKey, needleNameKey } from "@/lib/needle/cards";
import { YouTubePlayer, YouTubePlayerHandle } from "@/app/needle/YouTubePlayer";
import { BingoCard } from "@/app/needle/BingoCard";
import { useSpectator } from "@/lib/useSpectator";
import { prefersReducedMotion } from "@/lib/motion";
import { Marquee } from "@/app/components/brand";
import { CodeBadge } from "@/app/components/ui";
import { Stamp } from "@/app/components/fx";
import { Confetti } from "@/app/components/Confetti";

// How the win pattern reads on screen (the stored value is e.g. "fourcorners").
const PATTERN_LABEL: Record<Pattern, string> = {
  line: "Line",
  fourcorners: "Four corners",
  blackout: "Blackout",
};

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
  // The host can hold a card too and play from this screen.
  const [myCardId, setMyCardId] = useState<string | null>(null);
  const [seatName, setSeatName] = useState("");
  const [seatBusy, setSeatBusy] = useState(false);
  const [seatErr, setSeatErr] = useState<string | null>(null);
  const [peekTitles, setPeekTitles] = useState(false);
  // A fast double Enter must not deal the host two cards.
  const takingRef = useRef(false);
  useEffect(() => {
    if (tvRef.current) return;
    try {
      setMyCardId(localStorage.getItem(needleCardKey(code)));
    } catch {
      // Site storage blocked: the host just starts without a card.
    }
  }, [code, tvRef]);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
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
    try {
      const stored = localStorage.getItem(`needle-audio-${code}`);
      if (stored === "false") setIsAudioDevice(false);
      if (stored === "true") setIsAudioDevice(true);
    } catch {}
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
    try {
      if (localStorage.getItem(`needle-manual-${code}`) === "true") {
        setManualMode(true);
      }
    } catch {}
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
  const myCard = tv ? undefined : cards.find((c) => c.id === myCardId);
  // Song titles are the answers — mask them on a TV in front of the room and
  // for a host playing their own card (who can peek), except on Beginner
  // (auto-mark makes them public) or once the game ends.
  const titlesAreAnswers =
    game != null && game.difficulty !== "beginner" && game.status !== "ended";
  const hideTitles = titlesAreAnswers && (tv || (!!myCard && !peekTitles));

  async function takeCard() {
    const n = seatName.trim();
    if (!game || !n || myCard || takingRef.current) return;
    takingRef.current = true;
    setSeatBusy(true);
    setSeatErr(null);
    const { card, error } = await claimCard(game.id, n);
    if (error || !card) {
      setSeatErr(error ?? "Couldn't claim a card. Try again.");
      takingRef.current = false;
      setSeatBusy(false);
      return;
    }
    try {
      localStorage.setItem(needleCardKey(code), card.id);
      localStorage.setItem(needleNameKey(code), n);
    } catch {}
    setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)));
    setMyCardId(card.id);
    setSeatBusy(false);
  }

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

  // Someone yelled bingo: silence everything and freeze autoplay so the host
  // can verify the card without the next song stomping on the moment. Resume
  // restores autoplay (if it was on) and rolls straight into the next song.
  const wasAutoplayRef = useRef(false);
  const verifySectionRef = useRef<HTMLElement | null>(null);
  const verdictRef = useRef<HTMLDivElement | null>(null);

  function pauseForBingo() {
    wasAutoplayRef.current = autoplayRef.current;
    setAutoplay(false);
    clearAutoplayTimer();
    stopAll();
    if (tickRef.current) clearInterval(tickRef.current);
    setCountdown(0);
    setPaused(true);
    setTimeout(
      () => verifySectionRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }

  // Display only.  With a card on the host the titles are hidden, the page is
  // short, and the verdict renders below a laptop's fold.  Bring it into view
  // once it has rendered (a no-op when it is already on screen).
  function checkCard(id: string) {
    setVerifyId(id);
    setTimeout(
      () =>
        verdictRef.current?.scrollIntoView({
          block: "nearest",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        }),
      50,
    );
  }

  function resumeAfterBingo() {
    setPaused(false);
    if (wasAutoplayRef.current && game?.status !== "ended") {
      setAutoplay(true);
      scheduleAutoplay(1500);
    }
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
        <p className="text-fog">Loading game…</p>
      </main>
    );

  const verifyCard = cards.find((c) => c.id === verifyId);
  const verifyResult = verifyCard
    ? checkWin(verifyCard.grid, game.called, game.pattern)
    : null;

  return (
    <main className={`dark flex flex-1 flex-col gap-4 p-4 max-w-3xl mx-auto w-full ${tv ? "tv-mode" : ""}`}>
      <div className="flex items-center gap-2">
        <Link
          href="/needle/host"
          aria-label="Back to pools"
          className="tv-hide shrink-0 px-1 text-sm text-fog"
        >
          ←<span className="hidden sm:inline"> Pools</span>
        </Link>
        <Marquee
          icon="🎵"
          title="Needle Drop"
          sub={
            game.status === "ended"
              ? "Ended"
              : `Live · ${PATTERN_LABEL[game.pattern] ?? game.pattern}`
          }
          className="min-w-0"
        />
      </div>

      <CodeBadge code={game.code} />

      {!tv && !myCard && game.status !== "ended" && (
        <div className="rounded-2xl border-2 border-violet bg-card/60 p-4 flex flex-col gap-2">
          <div className="font-bold">🎟️ Playing too?</div>
          <div className="flex gap-2">
            <input
              value={seatName}
              onChange={(e) => setSeatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && takeCard()}
              placeholder="Your name"
              maxLength={20}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
            <button
              onClick={takeCard}
              disabled={seatBusy || !seatName.trim()}
              className="coin-btn coin-violet shrink-0 disabled:opacity-40"
            >
              <span className="coin-face px-4 py-2">
                {seatBusy ? "Dealing…" : "Get a card"}
              </span>
            </button>
          </div>
          <div className="text-xs text-zinc-500">
            Play a card right on this screen. Song titles hide while you play so
            you&apos;re listening like everyone else.
          </div>
          {seatErr && <p className="text-lose text-sm">{seatErr}</p>}
        </div>
      )}

      {!tv && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleManualMode}
            className={`press rounded-lg px-3 py-2 text-sm font-semibold ${
              manualMode
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {manualMode ? "✅ Manual mode (Spotify etc.)" : "Manual mode OFF"}
          </button>
          {!manualMode && (
            <button
              onClick={toggleAudioDevice}
              className={`press rounded-lg px-3 py-2 text-sm font-semibold ${
                isAudioDevice
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-100 border border-zinc-600"
              }`}
            >
              {isAudioDevice ? "🔊 Plays audio" : "📱 Remote only"}
            </button>
          )}
        </div>
      )}

      {!tv && !manualMode && isAudioDevice && (
        // Keep the YT player mounted for mixed pools, but only show it when a
        // YouTube-sourced song is actually the current one; Apple previews play
        // invisibly through an <audio> element.
        <div className={lastCalled && !songsById[lastCalled]?.preview ? "relative" : "hidden"}>
          <YouTubePlayer ref={playerRef} onUnplayable={handleUnplayable} />
          {/* A host playing a card should only hear the clip; the video would
              give the song away. The mask also takes taps, so the hidden
              player can't be opened full screen; Show titles removes it. */}
          {hideTitles && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-zinc-900 text-center text-zinc-300">
              <span className="font-semibold">🎵 Listen closely…</span>
              <span className="text-xs text-zinc-500">Tap Show titles to see the video.</span>
            </div>
          )}
        </div>
      )}

      {!tv && manualMode && (
        <div className="rounded-lg border-2 border-indigo-500 bg-indigo-950/40 p-3 flex flex-col gap-2">
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
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-base sm:text-sm"
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
                  className="text-left rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm hover:bg-indigo-900"
                >
                  {s.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {unplayableMsg && (
        <div className="rounded-lg bg-amber-950 border border-amber-400 text-amber-200 p-2 text-sm flex items-center justify-between">
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

      {/* Below sm the controls wrap onto their own row when the title needs the
          room, so a long title gets the panel's full width instead of about 100px. */}
      <div className="neon-panel p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Spins only while a clip plays on this device; never on a TV copy. */}
          <span
            aria-hidden
            className={`fx-vinyl attract text-3xl leading-none ${countdown > 0 ? "is-spinning" : ""}`}
          >
            💿
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-fog">Now playing</div>
            <div className="text-lg font-bold break-words">
              {!lastCalled
                ? "Waiting for the first song"
                : hideTitles
                  ? "🎵 Listen closely…"
                  : songsById[lastCalled]?.name ?? lastCalled}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {myCard && titlesAreAnswers && (
            <button
              onClick={() => setPeekTitles((v) => !v)}
              className="rounded-md border border-zinc-600 px-2 py-1 text-xs"
            >
              {peekTitles ? "🙈 Hide titles" : "👁 Show titles"}
            </button>
          )}
          {/* The clip timer runs on this device only, so a TV copy would sit at 0s. */}
          {!tv && <div className="text-3xl font-mono tabular-nums">{countdown}s</div>}
        </div>
      </div>

      {myCard && (
        <section className="rounded-2xl border-2 border-indigo-500 p-3">
          <BingoCard game={game} card={myCard} />
        </section>
      )}

      {!tv && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-700 p-2 gap-3">
          <button
            onClick={toggleAutoplay}
            disabled={game.status === "ended"}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              autoplay
                ? "bg-purple-600 text-white"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {autoplay ? "▶ Autoplay ON" : "Autoplay OFF"}
          </button>
          <label className="text-xs flex items-center gap-1 text-zinc-500">
            Gap:
            {/* 16px on phones:  iOS zooms the page into a smaller control. */}
            <select
              value={gapSeconds}
              onChange={(e) => setGapSeconds(Number(e.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-base sm:text-xs"
            >
              <option value={2}>2s</option>
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={8}>8s</option>
              <option value={10}>10s</option>
            </select>
          </label>
        </div>
      )}

      {!tv &&
        (!paused ? (
          <button
            onClick={pauseForBingo}
            disabled={game.status === "ended"}
            className="coin-btn coin-glow disabled:opacity-40"
          >
            <span className="coin-face py-4 text-lg">⏸ BINGO! Pause &amp; verify</span>
          </button>
        ) : (
          <div className="rounded-lg border-2 border-amber-500 bg-amber-950/60 p-3 flex items-center justify-between gap-3">
            <span className="font-bold text-amber-200">
              ⏸ Paused. Check the claimed card below.
            </span>
            <button onClick={resumeAfterBingo} className="coin-btn coin-win shrink-0">
              <span className="coin-face px-4 py-2">▶ Resume</span>
            </button>
          </div>
        ))}

      {!tv && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={nextSong}
              disabled={!nextId || game.status === "ended"}
              className="coin-btn coin-win disabled:opacity-40"
            >
              <span className="coin-face py-4">Next song</span>
            </button>
            <button
              onClick={replay}
              disabled={!lastCalled}
              className="coin-btn coin-violet disabled:opacity-40"
            >
              <span className="coin-face py-4">Replay clip</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={skipLast}
              disabled={!lastCalled}
              className="coin-btn coin-ghost disabled:opacity-40"
            >
              <span className="coin-face py-2 text-sm">⤺ Skip / undo</span>
            </button>
            <button
              onClick={deleteCurrent}
              disabled={!lastCalled}
              className="coin-btn coin-ghost disabled:opacity-40"
            >
              <span className="coin-face py-2 text-sm text-lose border-lose">
                🗑 Delete this song
              </span>
            </button>
          </div>
          <button
            onClick={endGame}
            disabled={game.status === "ended"}
            className="press rounded-lg border border-lose text-lose py-2 text-sm disabled:opacity-40"
          >
            End game
          </button>
        </>
      )}

      {!tv && (
        <section ref={verifySectionRef}>
          <h2 className="font-semibold mb-1">
            Verify a winner ({cards.filter((c) => c.claimed).length} cards claimed)
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {cards.map((c) => (
              <button
                key={c.id}
                onClick={() => checkCard(c.id)}
                className={`press rounded border p-2 text-sm ${
                  c.claimed ? "border-white" : "border-zinc-700 opacity-50"
                } ${verifyId === c.id ? "bg-yellow-900" : ""}`}
              >
                <div className="font-bold">{c.label}</div>
                <div className="text-xs truncate">
                  {c.player_name ?? "unclaimed"}
                </div>
              </button>
            ))}
          </div>
          {verifyCard && (
            // overflow-x-clip:  the Winner stamp enters at 2x and must not widen
            // a 375 host screen.  -mx-4 px-4 put the clip at the page edge.
            <div className="-mx-4 mt-3 flex flex-col gap-2 overflow-x-clip px-4">
              <div
                ref={verdictRef}
                className={`scroll-mb-4 rounded-xl border-2 bg-card p-3 flex flex-col items-center gap-2 text-center ${
                  verifyResult ? "border-win" : "border-lose"
                }`}
              >
                <div className="font-bold">
                  {verifyCard.label} · {verifyCard.player_name ?? "unclaimed"}
                </div>
                {verifyResult ? (
                  // Keyed so each newly checked winning card stamps again.
                  <Stamp key={verifyId} tone="win" size="lg">
                    Winner ✓
                  </Stamp>
                ) : (
                  <div className="font-bold text-lose">Not a win</div>
                )}
              </div>
              {verifyResult && <Confetti key={verifyId} />}
              <div className="grid grid-cols-5 gap-1">
                {verifyCard.grid.map((cell, i) => {
                  const isFree = "free" in cell;
                  const lit = isFree || game.called.includes(cell.youtube_id);
                  return (
                    <div
                      key={i}
                      className={`aspect-square text-[10px] p-1 flex items-center justify-center text-center rounded ${
                        lit ? "bg-win text-ink font-semibold" : "bg-zinc-800"
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
      )}

      <section>
        <h2 className="font-semibold mb-1">
          Called ({game.called.length}/{game.play_order.length})
        </h2>
        {hideTitles ? (
          <p className="text-sm text-zinc-500">
            {tv
              ? "Titles hidden on the big screen — that's the game! Full list appears when the game ends."
              : "Titles hidden while you play a card. Tap Show titles to peek."}
          </p>
        ) : (
          <ol className="text-sm space-y-0.5 list-decimal list-inside">
            {[...game.called].reverse().map((id, i) => (
              <li key={`${id}-${i}`}>{songsById[id]?.name ?? id}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
