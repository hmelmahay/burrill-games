"use client";

import { useEffect, useRef, useState } from "react";

// TV/spectator mode: host-screen URL + ?tv=1 renders a read-only scoreboard.
// `tv` (state) is for rendering — it flips after mount so SSR markup matches.
// `tvRef` is set synchronously on the client so phase-advancing effects can
// bail out even on their very first run; a TV copy must never compute scores
// or advance rounds, or it races the real host screen.
export function useSpectator() {
  const tvRef = useRef(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("tv"),
  );
  const [tv, setTv] = useState(false);
  useEffect(() => {
    setTv(tvRef.current);
  }, []);
  return { tv, tvRef };
}
