import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burrill Arcade Games",
  description: "Quiz Rush, Majority Rules, and Scatter Sprint — phones as controllers",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
