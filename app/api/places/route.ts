import { NextResponse } from "next/server";
import { z } from "zod";

import { cannabisCategoryList } from "@/lib/constants/categories";
import { boundsMaxDistanceToCenter, type MapBounds } from "@/lib/geo";
import { readCachedPlaces } from "@/lib/storage/place-cache";
import {
  MissingPlaceDatasetError,
  queryCannabisPlaces
} from "@/lib/services/place-repository";
import type { CannabisCategory } from "@/types/map";

export const runtime = "nodejs";

const querySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().default(1500),
  north: z.coerce.number().optional(),
  south: z.coerce.number().optional(),
  east: z.coerce.number().optional(),
  west: z.coerce.number().optional(),
  scope: z.enum(["city"]).optional(),
  categories: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined))
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

  const { lat, lng, radius, categories, north, south, east, west, scope } = parsed.data;

  const allowed = new Set<string>(cannabisCategoryList);
  const requested = (categories ?? cannabisCategoryList).filter((category) =>
    allowed.has(category)
  ) as CannabisCategory[];

  if (scope === "city") {
    const cache = await readCachedPlaces();
    if (!cache) {
      return NextResponse.json(
        {
          error: "City dataset not available. Run the sync cron first."
        },
        { status: 503 }
      );
    }

    const filtered = cache.cannabis.filter((feature) => {
      return !feature.cannabisCategory || requested.includes(feature.cannabisCategory);
    });

    return NextResponse.json({
      features: filtered,
      source: "cache",
      meta: {
        scope: "city",
        updatedAt: cache.updatedAt,
        bounds: cache.meta.bounds,
        radiusMeters: cache.meta.radiusMeters
      }
    });
  }

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng parameters are required" },
      {
        status: 400
      }
    );
  }

  let bounds: MapBounds | undefined;
  if (
    typeof north === "number" &&
    typeof south === "number" &&
    typeof east === "number" &&
    typeof west === "number"
  ) {
    bounds = { north, south, east, west };
  }

  const viewportRadius = bounds ? boundsMaxDistanceToCenter(bounds) : 0;
  const searchRadius = Math.max(radius, viewportRadius, 500);

  try {
    const response = await queryCannabisPlaces({
      location: { lat, lng },
      bounds,
      radiusMeters: searchRadius,
      categories: requested
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof MissingPlaceDatasetError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
