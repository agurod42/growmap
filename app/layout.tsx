import "./globals.css";
import type { Metadata } from "next";
import { GrowMapHeroUIProvider } from "@/components/providers";

export const metadata: Metadata = {
  title: "GrowMap | Cannabis Ecosystem Explorer",
  description:
    "Discover cannabis grow shops, dispensaries, and compliant club zones with an interactive Google Map experience."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <GrowMapHeroUIProvider>{children}</GrowMapHeroUIProvider>
      </body>
    </html>
  );
}
