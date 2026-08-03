// Scatter Sprint content: letters that have plenty of answers, and category prompts.
export const SCATTER_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K",
  "L", "M", "N", "P", "R", "S", "T", "W",
];

export const SCATTER_CATEGORIES = [
  "Pizza toppings",
  "Things at the beach",
  "Boys' names",
  "Girls' names",
  "Animals",
  "Countries",
  "Cities",
  "Movies",
  "TV shows",
  "Song titles",
  "Bands or musicians",
  "Foods",
  "Drinks",
  "Things in a kitchen",
  "Sports",
  "Famous athletes",
  "Jobs",
  "Things that are cold",
  "Things that are round",
  "Excuses for being late",
  "Things at a party",
  "Cartoon characters",
  "School subjects",
  "Car brands",
  "Clothing items",
  "Board games",
  "Ice cream flavours",
  "Fruits or vegetables",
  "Things in the sky",
  "Superheroes",
  "Restaurants",
  "Household chores",
  "Camping gear",
  "Hobbies",
  "Fictional characters",
  "Candy or chocolate bars",
  "Breakfast foods",
  "Things you shout",
  "Things in a garage",
  "Famous duos",
];

// Normalize an answer for duplicate detection: lowercase, trim,
// strip leading articles, collapse whitespace and punctuation.
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function startsWithLetter(answer: string, letter: string): boolean {
  const n = normalizeAnswer(answer);
  return n.length > 0 && n[0] === letter.toLowerCase();
}

export type CellState = "ok" | "dupe" | "invalid" | "rejected" | "empty";
export type JudgeOverride = "accept" | "reject";

// The judge's whole scoring model in one pure function: classify every cell,
// then cancel duplicates among the surviving answers. Host overrules (keyed
// `${playerId}:${catIdx}`) are absolute — "reject" always tosses, "accept"
// always scores. An accepted answer still counts against its unrescued twins,
// so accepting one of two "Tomato"s scores it while the other stays a dupe.
// The host page renders these states live in the judge grid and scores from
// the same array, so what the room sees is exactly what pays out.
export function judgeCellStates(
  entries: { id: string; answers: string[] }[],
  letter: string,
  numCategories: number,
  overrides: ReadonlyMap<string, JudgeOverride>,
): CellState[][] {
  const states: CellState[][] = entries.map(({ id, answers }) =>
    Array.from({ length: numCategories }, (_, ci) => {
      const a = answers[ci] ?? "";
      const ov = overrides.get(`${id}:${ci}`);
      if (!a.trim()) return "empty";
      if (ov === "reject") return "rejected";
      if (ov === "accept") return "ok";
      if (!startsWithLetter(a, letter)) return "invalid";
      return "ok";
    }),
  );
  for (let ci = 0; ci < numCategories; ci++) {
    const counts = new Map<string, number>();
    entries.forEach(({ answers }, pi) => {
      if (states[pi][ci] === "ok") {
        const n = normalizeAnswer(answers[ci] ?? "");
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    });
    entries.forEach(({ id, answers }, pi) => {
      if (
        states[pi][ci] === "ok" &&
        overrides.get(`${id}:${ci}`) !== "accept" &&
        (counts.get(normalizeAnswer(answers[ci] ?? "")) ?? 0) > 1
      ) {
        states[pi][ci] = "dupe";
      }
    });
  }
  return states;
}
