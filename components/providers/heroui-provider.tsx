"use client";

import { HeroUIProvider } from "@heroui/react";
import type { PropsWithChildren } from "react";

/**
 * Wraps the app with HeroUI's design system primitives.
 * Allows us to centralize theme configuration later if needed.
 */
export function GrowMapHeroUIProvider({ children }: PropsWithChildren) {
  return <HeroUIProvider>{children}</HeroUIProvider>;
}
