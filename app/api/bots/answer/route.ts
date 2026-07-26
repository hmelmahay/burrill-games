import Anthropic from "@anthropic-ai/sdk";

// Lets house bots answer honestly. A bot never sees the secret target or the
// correct answer — it gets what a player in its seat would see (the clue, the
// question, the choices) and works it out, the same as anyone else.
//
// Server-side because the API key must never reach the browser, where the bots
// actually run. Without ANTHROPIC_API_KEY this returns 503 and callers fall
// back to guessing blind — uninformed, but still not cheating.

export const runtime = "nodejs";
export const maxDuration = 30;

type VibeAsk = { kind: "vibe"; clue: string; left: string; right: string };
type QuizAsk = { kind: "quiz"; question: string; choices: string[] };
type BallparkAsk = { kind: "ballpark"; question: string; unit?: string };
type Ask = VibeAsk | QuizAsk | BallparkAsk;

const SYSTEM = `You are playing a party game, in the seat of an ordinary player.

You are never told the answer — work it out from what you are given, exactly as
a player would. Answer with your genuine best judgement even when unsure: a
sincere wrong answer is correct behaviour, refusing to guess is not.`;

const SCHEMAS = {
  vibe: {
    type: "object",
    properties: {
      position: {
        type: "integer",
        description: "Where the clue lands: 0 is the left end, 100 the right end",
      },
    },
    required: ["position"],
    additionalProperties: false,
  },
  quiz: {
    type: "object",
    properties: {
      choice: { type: "integer", description: "Index of the chosen answer, starting at 0" },
    },
    required: ["choice"],
    additionalProperties: false,
  },
  ballpark: {
    type: "object",
    properties: {
      value: { type: "number", description: "Your numeric estimate" },
    },
    required: ["value"],
    additionalProperties: false,
  },
} as const;

function parseAsk(body: Record<string, unknown>): Ask | null {
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;

  if (body.kind === "vibe") {
    const clue = str(body.clue, 120);
    const left = str(body.left, 60);
    const right = str(body.right, 60);
    return clue && left && right ? { kind: "vibe", clue, left, right } : null;
  }
  if (body.kind === "quiz") {
    const question = str(body.question, 400);
    const choices = Array.isArray(body.choices)
      ? body.choices.map((c) => str(c, 200)).filter((c): c is string => !!c)
      : [];
    return question && choices.length >= 2 && choices.length <= 6
      ? { kind: "quiz", question, choices }
      : null;
  }
  if (body.kind === "ballpark") {
    const question = str(body.question, 400);
    const unit = str(body.unit, 40) ?? undefined;
    return question ? { kind: "ballpark", question, unit } : null;
  }
  return null;
}

function promptFor(ask: Ask): string {
  switch (ask.kind) {
    case "vibe":
      return `A scale runs from "${ask.left}" (0) to "${ask.right}" (100). Another player picked a secret spot on it and wrote this clue to point at it:\n\n"${ask.clue}"\n\nWhere on the scale does that clue land?`;
    case "quiz":
      return `${ask.question}\n\n${ask.choices.map((c, i) => `${i}. ${c}`).join("\n")}\n\nWhich one is correct?`;
    case "ballpark":
      return `${ask.question}${ask.unit ? `\n\nAnswer in ${ask.unit}.` : ""}\n\nGive your best estimate as a number.`;
  }
}

function readAnswer(ask: Ask, parsed: Record<string, unknown>): Record<string, number> | null {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  switch (ask.kind) {
    case "vibe": {
      const p = num(parsed.position);
      return p === null ? null : { position: Math.max(0, Math.min(100, Math.round(p))) };
    }
    case "quiz": {
      const c = num(parsed.choice);
      return c === null || c < 0 || c >= ask.choices.length ? null : { choice: Math.round(c) };
    }
    case "ballpark": {
      const v = num(parsed.value);
      return v === null ? null : { value: v };
    }
  }
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "answer service not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const ask = parseAsk(body);
  if (!ask) {
    return Response.json({ error: "malformed request" }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        // Bots answer inside a live round, so keep it quick — this is a
        // judgement call, not deep reasoning.
        effort: "low",
        format: { type: "json_schema", schema: SCHEMAS[ask.kind] },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: promptFor(ask) }],
    });

    // A safety decline is a normal 200 with an empty or partial body — check
    // before reading content.
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "declined" }, { status: 503 });
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "no answer returned" }, { status: 502 });
    }

    const answer = readAnswer(ask, JSON.parse(text.text));
    if (!answer) {
      return Response.json({ error: "unreadable answer" }, { status: 502 });
    }

    return Response.json(answer);
  } catch (error) {
    console.error("bot answer:", error instanceof Error ? error.message : error);
    return Response.json({ error: "answer service failed" }, { status: 502 });
  }
}
