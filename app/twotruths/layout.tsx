import type { Metadata } from "next";
import { GAME_META } from "@/lib/games";

// Sets this game's accent (CSS [data-game]) and tab title on every /twotruths page.
// Server component: no JS, no flash. Owned by the foundation; game builders don't edit it.
export const metadata: Metadata = { title: GAME_META.twotruths.name };

export default function TwoTruthsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-game="twotruths" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
