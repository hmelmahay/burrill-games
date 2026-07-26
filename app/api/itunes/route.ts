import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for the iTunes Search API (no key needed; avoids CORS).
// Returns songs with 30-second Apple-hosted preview clips.
export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("term")?.trim();
  if (!term) {
    return NextResponse.json({ results: [] });
  }
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(term)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "needle-drop-music-bingo" },
    // Same search twice in a session shouldn't re-hit Apple.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json({ results: [], error: `iTunes search failed (${res.status})` }, { status: 502 });
  }
  const data = (await res.json()) as {
    results?: {
      trackId?: number;
      trackName?: string;
      artistName?: string;
      previewUrl?: string;
      artworkUrl60?: string;
    }[];
  };
  const results = (data.results ?? [])
    .filter((r) => r.trackId && r.trackName && r.previewUrl)
    .map((r) => ({
      trackId: r.trackId!,
      name: r.trackName!,
      artist: r.artistName ?? "",
      previewUrl: r.previewUrl!,
      artwork: r.artworkUrl60 ?? null,
    }));
  return NextResponse.json({ results });
}
