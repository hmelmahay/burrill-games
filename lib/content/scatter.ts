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
