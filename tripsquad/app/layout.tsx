import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "TripSquad: group trips planned in Claude",
  description: "Plan the trip in Claude. TripSquad turns it into a live, timed plan your whole group can edit, vote on and book from.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b3b4a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.className}>
      <body>{children}</body>
    </html>
  );
}
