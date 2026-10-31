"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usageRoute, deviceType } from "@/lib/usage";

export function UsageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const route = usageRoute(pathname);
    if (!route) return;
    let visitor: string, session: string;
    try {
      if (navigator.doNotTrack === "1" || localStorage.getItem("arcade-usage-optout") === "1") return;
      visitor = localStorage.getItem("arcade-usage-visitor") || crypto.randomUUID();
      localStorage.setItem("arcade-usage-visitor", visitor);
      const saved = JSON.parse(localStorage.getItem("arcade-usage-session") || "null");
      session = saved && Date.now() - saved.at < 30 * 60_000 ? saved.id : crypto.randomUUID();
    } catch { return; }
    let referrer = "";
    try { const url = new URL(document.referrer); if (url.host !== location.host) referrer = url.hostname.slice(0,120); } catch {}
    const record = (kind: string, game = "") => {
      if (document.visibilityState === "hidden") return;
      try {
        if (localStorage.getItem("arcade-usage-optout") === "1") return;
        const latest=JSON.parse(localStorage.getItem("arcade-usage-session") || "null");
        session=latest && Date.now()-latest.at<30*60_000 ? latest.id : crypto.randomUUID();
        localStorage.setItem("arcade-usage-session", JSON.stringify({id:session, at:Date.now()}));
      } catch { return; }
      // Analytics failure must never interrupt a game. No error messages or URLs are sent.
      void supabase.from("arcade_usage_events").insert({visitor_id:visitor, session_id:session,kind,game,route,device:deviceType(window.innerWidth),referrer}).then(() => {}, () => {});
    };
    // Delay avoids double-counting React StrictMode's development effect replay.
    const first = window.setTimeout(() => record("page_view"), 150);
    const timer = window.setInterval(() => record("heartbeat"), 60_000);
    const click = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[data-usage-game]");
      if (link) record("game_click", (link.getAttribute("data-usage-game") || "").slice(0,32));
    };
    let errors = 0;
    const error = () => { if (errors++ < 3) record("client_error"); };
    document.addEventListener("click", click);
    window.addEventListener("error",error);
    window.addEventListener("unhandledrejection",error);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener("click",click); window.removeEventListener("error",error); window.removeEventListener("unhandledrejection",error); };
  }, [pathname]);
  return null;
}
