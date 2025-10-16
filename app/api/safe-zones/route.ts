import { NextResponse } from "next/server";
import { z } from "zod";

import { readCachedPlaces } from "@/lib/storage/place-cache";
import { buildSafeZoneCache } from "@/lib/services/safe-zone-cache";
import { defaultCityId, getCityRestrictedCategories } from "@/lib/config/cities";
import { supportedCityIdsEnum } from "@/types/map";

export const runtime = "nodejs";

const querySchema = z.object({
  city: z.enum(supportedCityIdsEnum).optional()
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { city: requestedCity } = parsed.data;
  const cityId = requestedCity ?? defaultCityId;

  const cityRestrictedCategories = getCityRestrictedCategories(cityId);
  const cache = await readCachedPlaces();

  if (!cache) {
    return NextResponse.json(
      {
        error: "City dataset not available. Run the sync cron first."
      },
      { status: 503 }
    );
  }

  const cachedVariants = cache.safeZoneCache;
  const hasUpdatedCache = Array.isArray(cachedVariants)
    && cachedVariants.every((entry) => entry && "enabledZones" in entry && "restrictedPolygons" in entry);

  const variants = hasUpdatedCache
    ? (cachedVariants as ReturnType<typeof buildSafeZoneCache>)
    : buildSafeZoneCache(cityId, cache.restricted);

  return NextResponse.json({
    variants,
    restrictedCategories: cityRestrictedCategories,
    meta: {
      cityId,
      source: "cache",
      updatedAt: cache.updatedAt
    }
  });
}
