import "./globals.css";
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { GrowMapHeroUIProvider } from "@/components/providers";

export const metadata: Metadata = {
  title: "GrowMap | Cannabis Ecosystem Explorer",
  description:
    "Discover cannabis grow shops, dispensaries, and compliant club zones with an interactive Google Map experience."
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontSans.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <GrowMapHeroUIProvider>{children}</GrowMapHeroUIProvider>
      </body>
    </html>
  );
}
