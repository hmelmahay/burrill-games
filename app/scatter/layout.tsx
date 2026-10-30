import type { Metadata } from "next";
import { GAME_META } from "@/lib/games";

// Sets this game's accent (CSS [data-game]) and tab title on every /scatter page.
// Server component: no JS, no flash. Owned by the foundation; game builders don't edit it.
export const metadata: Metadata = { title: GAME_META.scatter.name };

export default function ScatterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-game="scatter" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
