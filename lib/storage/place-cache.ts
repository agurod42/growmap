import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { gunzip as gunzipCallback, gzip as gzipCallback } from "zlib";

import type { MapBounds } from "@/lib/geo";
import type { PlaceFeature } from "@/types/places";
import type { SafeZoneCacheEntry } from "@/types/safe-zone";

const DEFAULT_CACHE_DIR =
  process.env.PLACE_CACHE_DIR ?? path.join(process.cwd(), "data", "cache");
const CACHE_FILE =
  process.env.PLACE_CACHE_FILE ?? path.join(DEFAULT_CACHE_DIR, "montevideo-places.json.gz");
const LEGACY_CACHE_FILE = path.join(DEFAULT_CACHE_DIR, "montevideo-places.json");

const gzip = promisify(gzipCallback);
const gunzip = promisify(gunzipCallback);
const GZIP_MAGIC_BYTE_0 = 0x1f;
const GZIP_MAGIC_BYTE_1 = 0x8b;

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
  const candidates = [CACHE_FILE];
  if (!process.env.PLACE_CACHE_FILE && CACHE_FILE !== LEGACY_CACHE_FILE) {
    candidates.push(LEGACY_CACHE_FILE);
  }

  for (const candidate of candidates) {
    const dataset = await readCacheFile(candidate);
    if (dataset) {
      return dataset;
    }
  }

  return null;
}

export async function writeCachedPlaces(dataset: CachedPlaceDataset) {
  const directory = path.dirname(CACHE_FILE);
  await fs.mkdir(directory, { recursive: true });
  const jsonBuffer = Buffer.from(JSON.stringify(dataset, null, 2), "utf-8");
  const shouldCompress = CACHE_FILE.endsWith(".gz");
  const payload = shouldCompress ? await gzip(jsonBuffer, { level: 9 }) : jsonBuffer;
  await fs.writeFile(CACHE_FILE, payload);
}

export function getCachedPlacesPath() {
  return CACHE_FILE;
}

async function readCacheFile(filePath: string): Promise<CachedPlaceDataset | null> {
  try {
    const rawBuffer = await fs.readFile(filePath);
    const buffer = isGzip(rawBuffer) ? await gunzip(rawBuffer) : rawBuffer;
    return JSON.parse(buffer.toString("utf-8")) as CachedPlaceDataset;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isGzip(buffer: Buffer) {
  return buffer.length >= 2 && buffer[0] === GZIP_MAGIC_BYTE_0 && buffer[1] === GZIP_MAGIC_BYTE_1;
}
