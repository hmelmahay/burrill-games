import type { CSSProperties } from "react";

// Cartoon Steve and Mike, copied from the hub (burrill-arcade index.html at
// 1651c8c, lines 120-145 and 148-177) with the attributes renamed for JSX.
// Static on purpose:  no motion and no JS, so the landing page stays a plain
// server component.  The width/height attributes are only a fallback size for
// a browser that can't read clamp().
const SIZE: CSSProperties = {
  width: "clamp(72px,18vw,120px)",
  height: "auto",
  flexShrink: 0,
  position: "relative",
  zIndex: 2,
};

export function SteveAvatar() {
  return (
    <svg
      viewBox="0 0 170 208"
      width={120}
      height={147}
      role="img"
      aria-label="Cartoon Steve"
      style={{ ...SIZE, transform: "rotate(-5deg)" }}
    >
      <path d="M95 148 Q122 122 140 96" stroke="#ff9f1c" strokeWidth="24" fill="none" strokeLinecap="round" />
      <path d="M138 98 Q150 84 158 75" stroke="#e8b48f" strokeWidth="17" fill="none" strokeLinecap="round" />
      <circle cx="160" cy="73" r="11" fill="#e8b48f" />
      <path d="M28 195 Q30 150 70 143 Q110 150 112 195 Z" fill="#ff9f1c" />
      <path d="M55 147 Q70 157 85 147" stroke="#d88c00" strokeWidth="4" fill="none" />
      <rect x="57" y="118" width="26" height="28" rx="9" fill="#dfa77e" />
      <ellipse cx="70" cy="80" rx="36" ry="41" fill="#e8b48f" />
      <ellipse cx="57" cy="50" rx="15" ry="8" fill="#f6cba6" opacity="0.75" transform="rotate(-18 57 50)" />
      <ellipse cx="33" cy="86" rx="7" ry="10" fill="#dfa77e" />
      <ellipse cx="107" cy="86" rx="7" ry="10" fill="#dfa77e" />
      <path d="M45 69 Q54 64 63 68" stroke="#6b5a48" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M77 68 Q86 64 95 69" stroke="#6b5a48" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="55" cy="81" rx="7.5" ry="8" fill="#fff" />
      <ellipse cx="85" cy="81" rx="7.5" ry="8" fill="#fff" />
      <circle cx="56.5" cy="82" r="3.7" fill="#7d95a8" />
      <circle cx="83.5" cy="82" r="3.7" fill="#7d95a8" />
      <circle cx="56.5" cy="82" r="1.7" fill="#20242c" />
      <circle cx="83.5" cy="82" r="1.7" fill="#20242c" />
      <path d="M70 85 Q66 96 71 100" stroke="#d9a37e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M55 105 Q70 111 85 105 Q87 110 84 112 Q70 117 56 112 Q53 110 55 105 Z" fill="#a09b90" />
      <path d="M53 110 Q56 128 70 130 Q84 128 87 110 Q83 124 70 124 Q57 124 53 110 Z" fill="#a09b90" />
      <path d="M62 111 Q70 115 78 111" stroke="#8a6a55" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M60 118 l2 4 M70 121 l0 4 M80 118 l-2 4" stroke="#6e6a62" strokeWidth="1.6" strokeLinecap="round" />
      <text x="70" y="206" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="3" fill="#9aa0c8">STEVE</text>
    </svg>
  );
}

export function MikeAvatar() {
  return (
    <svg
      viewBox="0 0 170 208"
      width={120}
      height={147}
      role="img"
      aria-label="Cartoon Mike"
      style={{ ...SIZE, transform: "rotate(5deg)" }}
    >
      <path d="M75 148 Q48 122 30 96" stroke="#7c5cff" strokeWidth="24" fill="none" strokeLinecap="round" />
      <path d="M32 98 Q20 84 12 75" stroke="#e8b48f" strokeWidth="17" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="73" r="11" fill="#e8b48f" />
      <path d="M58 195 Q60 150 100 143 Q140 150 142 195 Z" fill="#7c5cff" />
      <path d="M85 147 Q100 157 115 147" stroke="#5f43d6" strokeWidth="4" fill="none" />
      <rect x="87" y="118" width="26" height="28" rx="9" fill="#dfa77e" />
      <ellipse cx="100" cy="82" rx="38" ry="41" fill="#e8b48f" />
      <path d="M61 70 Q60 40 100 36 Q140 40 139 70 Q136 52 122 50 Q104 46 86 50 Q64 54 61 70 Z" fill="#8d8577" />
      <ellipse cx="61" cy="88" rx="7" ry="10" fill="#dfa77e" />
      <ellipse cx="139" cy="88" rx="7" ry="10" fill="#dfa77e" />
      <path d="M75 66 Q84 62 92 65" stroke="#6b6257" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M108 65 Q116 62 125 66" stroke="#6b6257" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="71" y="72" width="26" height="20" rx="6" fill="rgba(255,255,255,0.06)" stroke="#3d3d3d" strokeWidth="3.5" />
      <rect x="103" y="72" width="26" height="20" rx="6" fill="rgba(255,255,255,0.06)" stroke="#3d3d3d" strokeWidth="3.5" />
      <path d="M97 78 L103 78" stroke="#3d3d3d" strokeWidth="3.5" />
      <path d="M71 78 L62 76 M129 78 L138 76" stroke="#3d3d3d" strokeWidth="3" />
      <ellipse cx="84" cy="82" rx="6.5" ry="7" fill="#fff" />
      <ellipse cx="116" cy="82" rx="6.5" ry="7" fill="#fff" />
      <circle cx="85" cy="83" r="3.4" fill="#6a5340" />
      <circle cx="115" cy="83" r="3.4" fill="#6a5340" />
      <circle cx="85" cy="83" r="1.6" fill="#20242c" />
      <circle cx="115" cy="83" r="1.6" fill="#20242c" />
      <path d="M100 86 Q96 97 101 101" stroke="#d9a37e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M83 105 Q100 124 117 105 Q114 120 100 121 Q86 120 83 105 Z" fill="#5d2f2a" />
      <path d="M85 106 Q100 115 115 106 L114 110 Q100 117 86 110 Z" fill="#fff" />
      <path d="M88 120 Q92 130 100 131 Q108 130 112 120 Q108 127 100 127 Q92 127 88 120 Z" fill="#a09b90" />
      <path d="M96 103 l-14 0 M118 103 l-4 0" stroke="none" />
      <text x="100" y="206" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="3" fill="#9aa0c8">MIKE</text>
    </svg>
  );
}
