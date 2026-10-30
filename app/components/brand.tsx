// Hook-free brand pieces: safe in server components (landing page, /tv) and in
// client components alike. No "use client" on purpose.
import { initialOf, playerHue } from "@/lib/fx";

// A lit sign: icon tile + name in the display font, with a bulb strip that
// chases once (4.8s) every time `burstKey` changes. No burstKey = still bulbs.
export function Marquee({
  icon,
  title,
  sub,
  size = "sm",
  burstKey,
  className = "",
}: {
  icon?: string;
  title: string;
  sub?: string;
  size?: "sm" | "lg";
  burstKey?: string | number;
  className?: string;
}) {
  return (
    <span className={`marquee marquee-${size} ${className}`}>
      {icon && (
        <span className="marquee-icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="marquee-title">{title}</span>
      {sub && <span className="marquee-sub">{sub}</span>}
      <span
        key={burstKey ?? "still"}
        aria-hidden
        className={`marquee-bulbs ${burstKey !== undefined ? "is-chasing attract" : ""}`}
      />
    </span>
  );
}

// A player's colored initial. Same color for the same player on every screen.
export function PlayerDot({
  id,
  name,
  size = "md",
  className = "",
}: {
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text = size === "sm" ? "text-xs" : size === "lg" ? "text-xl" : "text-sm";
  return (
    <span aria-hidden className={`player-dot ${text} ${className}`} style={{ background: playerHue(id) }}>
      {initialOf(name)}
    </span>
  );
}
