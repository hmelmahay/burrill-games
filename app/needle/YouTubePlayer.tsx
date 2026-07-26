"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
type YTPlayer = {
  loadVideoById: (opts: string | { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
};

export type YouTubePlayerHandle = {
  play: (id: string, seconds: number) => void;
  replay: (seconds: number) => void;
  stop: () => void;
};

type Props = {
  onUnplayable?: (id: string) => void;
};

let apiLoading: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiLoading) return apiLoading;
  apiLoading = new Promise<void>((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoading;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  props,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<{ id: string; seconds: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const pendingClipSecondsRef = useRef<number | null>(null);
  const onUnplayableRef = useRef(props.onUnplayable);
  onUnplayableRef.current = props.onUnplayable;

  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        width: "100%",
        height: "200",
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (queueRef.current) {
              const q = queueRef.current;
              queueRef.current = null;
              doPlay(q.id, q.seconds);
            }
          },
          onStateChange: (e: { data: number }) => {
            // data === 1 means PLAYING. Start the clip timer here so pre-roll
            // ads don't eat into the clip.
            if (e?.data === 1 && pendingClipSecondsRef.current != null) {
              const secs = pendingClipSecondsRef.current;
              pendingClipSecondsRef.current = null;
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => {
                try {
                  playerRef.current?.pauseVideo();
                } catch {}
              }, secs * 1000);
            }
          },
          onError: (e: { data: number }) => {
            // Only treat true embed-blocking errors as unplayable:
            //   100 = video not found / removed
            //   101, 150 = embedding disabled by uploader
            // Codes 2 (invalid id) and 5 (HTML5 player error) often fire
            // transiently on iOS for non-content reasons (gesture, mute,
            // power state) — don't auto-skip on those.
            const id = lastIdRef.current;
            const code = e?.data;
            console.warn("YT error", code, "for id", id);
            if (
              id &&
              (code === 100 || code === 101 || code === 150) &&
              onUnplayableRef.current
            ) {
              onUnplayableRef.current(id);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        playerRef.current?.destroy();
      } catch {}
    };
  }, []);

  function doPlay(id: string, seconds: number) {
    if (!playerRef.current) return;
    lastIdRef.current = id;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Defer clip-timer start until onStateChange fires PLAYING (skips pre-roll ad time).
    pendingClipSecondsRef.current = seconds;
    // Start 20s in so we skip intros and (usually) the worst of pre-roll dead air.
    playerRef.current.loadVideoById({ videoId: id, startSeconds: 20 });
    playerRef.current.playVideo();
    // Safety net: if we never get a PLAYING event in 30s, kill it anyway.
    timerRef.current = setTimeout(() => {
      pendingClipSecondsRef.current = null;
      try {
        playerRef.current?.pauseVideo();
      } catch {}
    }, (seconds + 30) * 1000);
  }

  useImperativeHandle(ref, () => ({
    play(id, seconds) {
      if (!readyRef.current) {
        queueRef.current = { id, seconds };
        return;
      }
      doPlay(id, seconds);
    },
    replay(seconds) {
      if (lastIdRef.current) doPlay(lastIdRef.current, seconds);
    },
    stop() {
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        playerRef.current?.stopVideo();
      } catch {}
    },
  }));

  return (
    <div className="rounded-lg overflow-hidden bg-black aspect-video">
      <div ref={containerRef} />
    </div>
  );
});
