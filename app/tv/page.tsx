import { supabase, Room } from "@/lib/supabase";
import { GAME_NAMES } from "./games";
import CodeInput from "./CodeInput";

// One bookmarkable address for the big screen. Live rooms are looked up
// server-side and rendered as plain tappable links, so a TV that opens /tv
// sees the current game's code without anyone typing it; the code form stays
// underneath for rooms that don't show (or a house with several games going).
//
// Deliberately a server component with plain HTML links and a plain form:
// some TV browsers never manage to run our JS bundle, and this page is the
// one they must not break on. Errors round-trip through ?err= so they render
// without JS too.
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  short: "Room codes are 4 characters.",
  ended: "That game already ended.",
  notfound: "No room with that code. Double-check it?",
  lookup: "Couldn't reach the game server — check the TV's internet and try again.",
};

// Only rooms created recently count as "live" — abandoned lobbies from last
// week shouldn't clutter the TV.
const LIVE_WINDOW_HOURS = 3;
const MAX_LIVE_ROOMS = 6;

async function liveRooms(): Promise<Room[]> {
  try {
    const since = new Date(Date.now() - LIVE_WINDOW_HOURS * 3600_000).toISOString();
    const { data } = await supabase
      .from("arcade_rooms")
      .select("*")
      .neq("status", "ended")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_LIVE_ROOMS);
    return (data ?? []) as Room[];
  } catch {
    return []; // discovery is a bonus — never break the typed-code path
  }
}

function age(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default async function TvEntry({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; code?: string }>;
}) {
  const { err, code } = await searchParams;
  const errMsg = err ? ERRORS[err] ?? ERRORS.notfound : null;
  const rooms = await liveRooms();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="text-5xl">📺</div>
      <h1 className="text-3xl font-extrabold text-center">Big-screen scoreboard</h1>

      {rooms.length > 0 && (
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <p className="text-fog">Live now — tap to put it on this screen:</p>
          {rooms.map((r) => (
            <a
              key={r.id}
              href={`/tv/go?code=${r.code}`}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-glow bg-card px-5 py-4 transition hover:bg-cardhover"
            >
              <span className="font-mono text-3xl font-extrabold tracking-[0.15em] text-glow">
                {r.code}
              </span>
              <span className="flex-1 font-bold text-lg">
                {GAME_NAMES[r.game] ?? r.game}
              </span>
              <span className="text-fog text-sm text-right">
                {r.status === "lobby" ? "in the lobby" : "playing"}
                <br />
                {age(r.created_at)}
              </span>
            </a>
          ))}
        </div>
      )}

      <p className="text-fog text-center max-w-sm">
        {rooms.length > 0
          ? "Or enter a room code from the host's screen:"
          : "Enter the room code from the host's screen. This TV becomes the room's scoreboard — no buttons, no spoilers, works for every game."}
      </p>
      <form action="/tv/go" method="get" className="flex flex-col items-center gap-4">
        <CodeInput initialCode={code ?? ""} />
        <button
          type="submit"
          className="rounded-xl bg-glow px-8 py-4 text-lg font-bold text-[#1a1000] transition hover:brightness-110"
        >
          Open scoreboard →
        </button>
      </form>
      {errMsg && <p className="text-lose text-center">{errMsg}</p>}
      <p className="text-fog text-xs text-center max-w-xs">
        Tip: bookmark this page on your TV — the address never changes.
      </p>
    </main>
  );
}
