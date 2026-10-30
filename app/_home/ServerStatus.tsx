"use client";

import { useEffect, useState } from "react";

// Render's free servers sleep when idle and take about a minute to wake.  The
// arcade pings them as soon as anyone opens it, so a game is already waking
// by the time someone taps Host or Join.  no-cors:  only reaching the server
// matters, not reading its reply.
export function ServerStatus({ url }: { url: string }) {
  const [state, setState] = useState<"checking" | "ready" | "waking">("checking");
  const [quick, setQuick] = useState(true);
  useEffect(() => {
    let live = true;
    const started = Date.now();
    fetch(url, { mode: "no-cors", cache: "no-store" })
      .then(() => {
        if (!live) return;
        setQuick(Date.now() - started < 3000);
        setState("ready");
      })
      .catch(() => live && setState("waking"));
    return () => {
      live = false;
    };
  }, [url]);
  const text =
    state === "ready"
      ? quick
        ? "Ready to play"
        : "Awake and ready"
      : state === "waking"
        ? "Waking up the server.  The first load can take about a minute."
        : "Warming up the server…";
  return (
    <span className="flex items-center gap-2 text-xs text-fog">
      <span
        aria-hidden
        className={`led ${state === "ready" ? "on" : ""}`}
        style={state === "ready" ? undefined : { background: "#ff9f1c" }}
      />
      {text}
    </span>
  );
}
