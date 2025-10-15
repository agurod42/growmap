import type { RestrictedCategory } from "@/types/map";

export function safeZoneCacheKey(categories: RestrictedCategory[]): string {
  if (!categories.length) {
    return "none";
  }
  return [...categories].sort().join("|");
}
