// Forgiving answer matching for typed-guess games.
export function normalizeGuess(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

// Correct if the normalized guess equals the answer or an alt, allowing
// 1 typo (2 for longer answers).
export function guessMatches(guess: string, answer: string, alts: string[] = []): boolean {
  const g = normalizeGuess(guess);
  if (!g) return false;
  const targets = [answer, ...alts].map(normalizeGuess);
  return targets.some((t) => {
    if (g === t) return true;
    const tolerance = t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0;
    return editDistance(g, t) <= tolerance;
  });
}
