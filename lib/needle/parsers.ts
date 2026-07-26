// YouTube URL/ID parser — accepts any common shape and returns the 11-char ID or null.
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (YT_ID_RE.test(s)) return s;
  // Try URL parse
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return YT_ID_RE.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && YT_ID_RE.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /v/ID, /live/ID
      const idx = parts.findIndex((p) =>
        ["embed", "shorts", "v", "live"].includes(p),
      );
      if (idx !== -1 && parts[idx + 1] && YT_ID_RE.test(parts[idx + 1])) {
        return parts[idx + 1];
      }
    }
  } catch {
    // not a URL
  }
  // Last resort: maybe there's an 11-char token in there
  const m = s.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Bulk paste: one song per line, "Name | URL" preferred. Also tolerate "Name - URL".
// Returns parsed rows + the raw lines that failed.
export type ParsedSong = { name: string; youtube_id: string };
export type BulkParseResult = {
  rows: ParsedSong[];
  failures: string[];
};

export function parseBulkSongs(text: string): BulkParseResult {
  const rows: ParsedSong[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let name = "";
    let urlPart = "";
    if (line.includes("|")) {
      const [a, ...rest] = line.split("|");
      name = a.trim();
      urlPart = rest.join("|").trim();
    } else if (/\s-\s/.test(line)) {
      const idx = line.search(/\s-\shttps?:\/\//);
      if (idx !== -1) {
        name = line.slice(0, idx).trim();
        urlPart = line.slice(idx + 3).trim();
      } else {
        const parts = line.split(/\s-\s/);
        urlPart = parts.pop()!.trim();
        name = parts.join(" - ").trim();
      }
    } else {
      // bare URL or ID, use ID as the name fallback
      urlPart = line;
    }
    const id = parseYoutubeId(urlPart);
    if (!id) {
      failures.push(raw);
      continue;
    }
    if (!name) name = id;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ name, youtube_id: id });
  }
  return { rows, failures };
}

// 4-char join code, unambiguous chars only.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
export function generateCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Shuffle (Fisher-Yates), non-mutating.
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
