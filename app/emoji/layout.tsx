import type { Metadata } from "next";
import { GAME_META } from "@/lib/games";

// Sets this game's accent (CSS [data-game]) and tab title on every /emoji page.
// Server component: no JS, no flash. Owned by the foundation; game builders don't edit it.
export const metadata: Metadata = { title: GAME_META.emoji.name };

export default function EmojiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-game="emoji" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
