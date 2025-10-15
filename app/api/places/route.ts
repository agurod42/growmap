import { NextResponse } from "next/server";
import { z } from "zod";

import { readCachedPlaces } from "@/lib/storage/place-cache";
import { defaultCityId } from "@/lib/config/cities";
import { isPointInsideCity } from "@/lib/land";
import { supportedCityIdsEnum } from "@/types/map";

export const runtime = "nodejs";

const querySchema = z.object({
  city: z.enum(supportedCityIdsEnum).optional()
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      {
        status: 400
      }
    );
  }

  const { city } = parsed.data;
  const cityId = city ?? defaultCityId;

  const cache = await readCachedPlaces();
  if (!cache) {
    return NextResponse.json(
      {
        error: "City dataset not available. Run the sync cron first."
      },
      { status: 503 }
    );
  }

  const cannabis = cache.cannabis.filter((feature) =>
    isPointInsideCity(cityId, feature.location)
  );

  const restricted = cache.restricted.filter((feature) =>
    isPointInsideCity(cityId, feature.location)
  );

  return NextResponse.json({
    cannabis,
    restricted,
    source: "cache",
    meta: {
      cityId,
      updatedAt: cache.updatedAt,
      bounds: cache.meta.bounds
    }
  });
}
