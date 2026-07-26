import Anthropic from "@anthropic-ai/sdk";

// Reads a Vibe Check clue and says where it lands on the scale, so house bots
// can guess from what the psychic actually wrote instead of peeking at the
// answer. Runs server-side because the API key must never reach the browser.
//
// Without ANTHROPIC_API_KEY this returns 503 and the caller falls back to its
// old behaviour — the game keeps working, the bots just stop comprehending.

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM = `You place a clue on a two-ended scale for a party game.

The players are told the two ends of a scale and one short clue written by
another player. They slide a dial from 0 (the left end) to 100 (the right end)
to guess where the clue-writer was pointing.

Answer as a thoughtful player would: read the clue, judge where it sits between
the two ends, and give that position. Use the full range — a clue that clearly
belongs at an extreme should score near 0 or 100, and only a genuinely middling
clue belongs near 50. Judge the clue on ordinary shared intuition, not on
technicalities.`;

const SCHEMA = {
  type: "object",
  properties: {
    position: {
      type: "integer",
      description: "Where the clue lands, 0 = the left end, 100 = the right end",
    },
  },
  required: ["position"],
  additionalProperties: false,
} as const;

function clampPosition(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "clue reader not configured" }, { status: 503 });
  }

  let body: { clue?: unknown; left?: unknown; right?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const clue = typeof body.clue === "string" ? body.clue.trim() : "";
  const left = typeof body.left === "string" ? body.left.trim() : "";
  const right = typeof body.right === "string" ? body.right.trim() : "";

  // The scale ends come from our own content; the clue is player-written, so
  // bound it. These are also the only inputs, which keeps the endpoint cheap
  // to serve and dull to abuse.
  if (!clue || !left || !right) {
    return Response.json({ error: "clue, left and right are required" }, { status: 400 });
  }
  if (clue.length > 120 || left.length > 60 || right.length > 60) {
    return Response.json({ error: "input too long" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Scale: 0 = "${left}", 100 = "${right}".\nClue: "${clue}"\n\nWhere on the scale does that clue land?`,
        },
      ],
    });

    // A safety decline arrives as a normal 200 with an empty or partial body —
    // check before reading content, or this throws on the happy path's shape.
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "clue declined" }, { status: 503 });
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "no reading returned" }, { status: 502 });
    }

    const position = clampPosition(JSON.parse(text.text)?.position);
    if (position === null) {
      return Response.json({ error: "unreadable reading" }, { status: 502 });
    }

    return Response.json({ position });
  } catch (error) {
    const message = error instanceof Error ? error.message : "clue reader failed";
    console.error("vibe clue reader:", message);
    return Response.json({ error: "clue reader failed" }, { status: 502 });
  }
}
