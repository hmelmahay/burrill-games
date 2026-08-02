import { NextResponse } from "next/server";
import { supabase, Room, Player, GameKind } from "@/lib/supabase";

// Legacy-TV scoreboard: a self-refreshing, server-rendered page with zero
// dependence on client JS or modern CSS. Some TV browsers never run our React
// bundle (the host screen sits on "Loading…" forever), so /tv/go lands here
// instead: plain HTML, inline 2010-era CSS, and a <meta refresh> re-pull.
// Browsers that prove they can run modern JS immediately upgrade themselves to
// the real host screen in ?tv=1 mode; everyone else keeps the simple board.
//
// Spectators must never run engine logic — this page runs nothing at all, so
// it is safe by construction.
export const dynamic = "force-dynamic";

const REFRESH_SECONDS = 6;

const GAME_NAMES: Record<GameKind, string> = {
  quiz: "⚡ Quiz Rush",
  majority: "🐑 Majority Rules",
  scatter: "📝 Scatter Sprint",
  emoji: "🎬 Emoji Cinema",
  ballpark: "🎯 Ballpark",
  twotruths: "🤥 Two Truths & a Lie",
  hottake: "🔥 Hot Take",
  doodle: "🎨 Doodle Dash",
  vibe: "🌡️ Vibe Check",
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLine(room: Room) {
  if (room.status === "lobby") return "Waiting in the lobby — join with the code!";
  if (room.status === "ended") return "Game over — final scores!";
  return `Round ${room.round_idx + 1} in progress`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (code.length !== 4) {
    return NextResponse.redirect(new URL("/tv?err=notfound", request.url), 303);
  }

  const { data } = await supabase
    .from("arcade_rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  const room = data as Room | null;
  if (!room) {
    return NextResponse.redirect(new URL("/tv?err=notfound", request.url), 303);
  }

  const { data: pdata } = await supabase
    .from("arcade_players")
    .select("*")
    .eq("room_id", room.id)
    .order("score", { ascending: false });
  const players = (pdata ?? []) as Player[];

  const rows = players
    .map((p, i) => {
      const rank = i === 0 && players.length > 1 ? "👑" : String(i + 1);
      return `<tr>
        <td class="rank">${rank}</td>
        <td class="name">${esc(p.name)}</td>
        <td class="score">${p.score}</td>
      </tr>`;
    })
    .join("");

  const gameName = GAME_NAMES[room.game] ?? room.game;
  // Upgrade to the live React scoreboard only if this browser can parse and
  // run modern JS — the eval is a syntax probe, not a capability shim. TVs
  // that fail it (or have JS off) simply stay on this self-refreshing page.
  const upgrade = `<script>
try {
  eval("async () => { const probe = (x) => x?.y ?? 0; };");
  if (window.fetch && window.Promise && window.WebSocket && window.CSS && CSS.supports("display","flex")) {
    location.replace(${JSON.stringify(`/${room.game}/host/${room.code}?tv=1`)});
  }
} catch (e) {}
</script>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="${REFRESH_SECONDS}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(gameName)} — scoreboard</title>
<style>
  body { background: #0d1026; color: #f2f3ff; margin: 0; padding: 40px 20px;
         font-family: Arial, Helvetica, sans-serif; text-align: center; }
  .badge { border: 1px solid #7c5cff; color: #9aa0c8; display: inline-block;
           padding: 4px 14px; border-radius: 14px; font-size: 18px; }
  h1 { font-size: 44px; margin: 18px 0 6px 0; }
  .status { color: #9aa0c8; font-size: 26px; margin: 0 0 26px 0; }
  .codebox { border: 2px solid #ff9f1c; background: #171b3a; border-radius: 16px;
             display: inline-block; padding: 14px 40px; margin-bottom: 30px; }
  .codelabel { color: #9aa0c8; font-size: 16px; letter-spacing: 5px; }
  .code { color: #ff9f1c; font-family: 'Courier New', monospace; font-weight: bold;
          font-size: 84px; letter-spacing: 14px; }
  table { margin: 0 auto; border-collapse: collapse; width: 90%; max-width: 700px; }
  td { border-bottom: 1px solid #2a3060; padding: 12px 16px; font-size: 34px; }
  .rank { color: #9aa0c8; width: 60px; }
  .name { text-align: left; font-weight: bold; }
  .score { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
  .empty { color: #9aa0c8; font-size: 26px; }
  .foot { color: #9aa0c8; font-size: 16px; margin-top: 34px; }
</style>
</head>
<body>
<div class="badge">📺 TV scoreboard</div>
<h1>${esc(gameName)}</h1>
<p class="status">${esc(statusLine(room))}</p>
<div class="codebox">
  <div class="codelabel">JOIN CODE</div>
  <div class="code">${esc(room.code)}</div>
</div>
${
  players.length
    ? `<table>${rows}</table>`
    : `<p class="empty">Nobody has joined yet…</p>`
}
<p class="foot">Updates every ${REFRESH_SECONDS} seconds — no buttons, no spoilers.</p>
${upgrade}
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
