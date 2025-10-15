import { promises as fs } from "fs";
import path from "path";

import type { MapBounds } from "@/lib/geo";
import type { PlaceFeature } from "@/types/places";
import type { SafeZoneCacheEntry } from "@/types/safe-zone";

const DEFAULT_CACHE_DIR =
  process.env.PLACE_CACHE_DIR ?? path.join(process.cwd(), "data", "cache");
const CACHE_FILE =
  process.env.PLACE_CACHE_FILE ?? path.join(DEFAULT_CACHE_DIR, "montevideo-places.json");

export type CachedPlaceDataset = {
  updatedAt: string;
  cannabis: PlaceFeature[];
  restricted: PlaceFeature[];
  safeZoneCache?: SafeZoneCacheEntry[];
  meta: {
    bounds: MapBounds;
    radiusMeters: number;
    cannabisCategories: string[];
    restrictedCategories: string[];
  };
};

export async function readCachedPlaces(): Promise<CachedPlaceDataset | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CachedPlaceDataset;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCachedPlaces(dataset: CachedPlaceDataset) {
  const directory = path.dirname(CACHE_FILE);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(dataset, null, 2), "utf-8");
}

export function getCachedPlacesPath() {
  return CACHE_FILE;
}
