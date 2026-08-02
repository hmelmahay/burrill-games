import { NextResponse } from "next/server";
import { supabase, Room } from "@/lib/supabase";

// Server-side room lookup for the /tv entry form. The form does a plain GET
// here so the big-screen flow works even when the TV browser can't run our
// JS bundle at all — the reported failure mode: clicking submit reloaded the
// page instead of navigating, because React never hydrated.
export const dynamic = "force-dynamic";

function back(reqUrl: string, err: string, code: string) {
  const url = new URL("/tv", reqUrl);
  url.searchParams.set("err", err);
  if (code) url.searchParams.set("code", code);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  const reqUrl = request.url;
  const raw = new URL(reqUrl).searchParams.get("code") ?? "";
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (code.length !== 4) return back(reqUrl, "short", code);

  try {
    const { data } = await supabase
      .from("arcade_rooms")
      .select("game,code,status")
      .eq("code", code)
      .maybeSingle();
    const room = data as Pick<Room, "game" | "code" | "status"> | null;
    if (room) {
      if (room.status === "ended") return back(reqUrl, "ended", code);
      // Land on the no-JS legacy scoreboard; browsers that can run the React
      // bundle upgrade themselves to the live ?tv=1 host screen from there.
      return NextResponse.redirect(
        new URL(`/tv/view/${room.code}`, reqUrl),
        303
      );
    }

    // Not an arcade room — maybe it's a Needle Drop (music bingo) game.
    const { data: nd } = await supabase
      .from("games")
      .select("code,status")
      .eq("code", code)
      .maybeSingle();
    const ndGame = nd as { code: string; status: string } | null;
    if (!ndGame) return back(reqUrl, "notfound", code);
    if (ndGame.status === "ended") return back(reqUrl, "ended", code);
    return NextResponse.redirect(
      new URL(`/needle/host/game/${ndGame.code}?tv=1`, reqUrl),
      303
    );
  } catch {
    return back(reqUrl, "lookup", code);
  }
}
