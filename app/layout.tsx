import type { Metadata, Viewport } from "next";
import { Bungee } from "next/font/google";
import "./globals.css";
import { UsageTracker } from "./components/UsageTracker";

// Display font for signs, stamps and rank badges only. Codes, timers and
// scores stay monospace; prompts, names and buttons stay in the system font.
const display = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee", display: "swap" });

// This app is the whole arcade:  burrill-arcade.vercel.app forwards here.
const DESCRIPTION = "Pick a game. Host it and share the code, or join a friend's room.";
export const metadata: Metadata = {
  title: { default: "The Burr & Spill", template: "%s · The Burr & Spill" },
  description: DESCRIPTION,
  openGraph: {
    title: "The Burr & Spill",
    description: DESCRIPTION,
    url: "https://burrill-games.vercel.app/",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d1026",
};

// QA hook: add ?motion=reduce to any URL to see the reduced-motion version
// on a device whose OS setting you can't change (TVs, agent browsers).
const RM_SCRIPT =
  'try{if(/[?&]motion=reduce/.test(location.search))document.documentElement.classList.add("fx-rm")}catch(e){}';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${display.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: RM_SCRIPT }} />
        <UsageTracker />
        {children}
      </body>
    </html>
  );
}
