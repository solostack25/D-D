import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tavernlight — your online table",
  description: "Play tabletop fantasy RPG sessions together from anywhere: shared table, live dice, character creator and an AI Dungeon Master.",
};

export const viewport: Viewport = {
  themeColor: "#0e0f14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@400;500;600;700&family=Spectral:ital,wght@0,400;0,500;1,400&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-parch">{children}</body>
    </html>
  );
}
