import type { Metadata, Viewport } from "next";
import { Bungee } from "next/font/google";
import "./globals.css";

// Display font for signs, stamps and rank badges only. Codes, timers and
// scores stay monospace; prompts, names and buttons stay in the system font.
const display = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee", display: "swap" });

export const metadata: Metadata = {
  title: { default: "The Burr & Spill — Games", template: "%s · The Burr & Spill" },
  description: "Party games from Steve Burrill & Mike Spille — phones as controllers",
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
        {children}
      </body>
    </html>
  );
}
