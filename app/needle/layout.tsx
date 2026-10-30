import type { Metadata } from "next";
import { GAME_META } from "@/lib/games";

// Sets this game's accent (CSS [data-game]) and tab title on every /needle page.
// Server component: no JS, no flash. Owned by the foundation; game builders don't edit it.
export const metadata: Metadata = { title: GAME_META.needle.name };

export default function NeedleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-game="needle" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
