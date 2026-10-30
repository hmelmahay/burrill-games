import { supabase, Card } from "./types";

// Claim the next free card in a game for `name`. The update only matches a
// card that is still unclaimed, so if two people join at the same moment the
// slower one moves on to the next card instead of sharing the first.
export async function claimCard(
  gameId: string,
  name: string,
): Promise<{ card?: Card; error?: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: free, error: cErr } = await supabase
      .from("cards")
      .select("*")
      .eq("game_id", gameId)
      .eq("claimed", false)
      .order("label", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (cErr || !free) return { error: "All cards taken in this game." };
    const { data: mine, error: uErr } = await supabase
      .from("cards")
      .update({ claimed: true, player_name: name })
      .eq("id", (free as Card).id)
      .eq("claimed", false)
      .select()
      .maybeSingle();
    if (uErr) return { error: "Couldn't claim a card. Try again." };
    if (mine) return { card: mine as Card };
  }
  return { error: "Couldn't claim a card. Try again." };
}

// localStorage keys so a refresh finds the same card again.
export const needleCardKey = (code: string) => `needle-card-${code}`;
export const needleNameKey = (code: string) => `needle-name-${code}`;
