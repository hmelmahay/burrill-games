import { supabase, Player, Room } from "./supabase";
import { nextBotName, botsOf } from "./bot-logic";

// Pure helpers live in ./bot-logic so they are testable without a database;
// re-exported here so callers have one import.
export {
  BOT_SUFFIX,
  BOT_NAMES,
  isBot,
  humansOf,
  botsOf,
  botSkill,
  botDelayMs,
  botDialGuess,
  botNumberGuess,
  crowdBias,
  botBinaryVote,
  botPredict,
  botQuizChoice,
  botQuizDelayMs,
  hotTakeFavourite,
  botHotTakeVote,
} from "./bot-logic";

export async function addBot(room: Room, players: Player[]): Promise<string | null> {
  const name = nextBotName(players);
  if (!name) return "All the bots are already seated.";
  const { error } = await supabase
    .from("arcade_players")
    .insert({ room_id: room.id, name });
  return error ? error.message : null;
}

export async function removeBot(players: Player[]): Promise<string | null> {
  const bot = botsOf(players).at(-1);
  if (!bot) return null;
  const { error } = await supabase.from("arcade_players").delete().eq("id", bot.id);
  return error ? error.message : null;
}
