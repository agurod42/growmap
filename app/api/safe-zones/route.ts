import { NextResponse } from "next/server";
import { z } from "zod";

import { restrictedCategoryList } from "@/lib/constants/categories";
import { boundsMaxDistanceToCenter, type MapBounds } from "@/lib/geo";
import { computeSafeZones } from "@/lib/club-zones";
import { readCachedPlaces } from "@/lib/storage/place-cache";
import {
  MissingPlaceDatasetError,
  queryRestrictedPlaces
} from "@/lib/services/place-repository";
import type { RestrictedCategory } from "@/types/map";

export const runtime = "nodejs";

const boundsSchema = z.object({
  north: z.coerce.number(),
  south: z.coerce.number(),
  east: z.coerce.number(),
  west: z.coerce.number()
});

const querySchema = boundsSchema.extend({
  centerLat: z.coerce.number(),
  centerLng: z.coerce.number(),
  radius: z.coerce.number(),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { north, south, east, west, centerLat, centerLng, radius, categories, scope } = parsed.data;
  const bounds: MapBounds = { north, south, east, west };
  const center = { lat: centerLat, lng: centerLng };

  const allowed = new Set<string>(restrictedCategoryList);
  const requested = (categories ?? restrictedCategoryList).filter((category) =>
    allowed.has(category)
  ) as RestrictedCategory[];

  const useCityScope = scope === "city";
  const cache = await readCachedPlaces();

  if (useCityScope && !cache) {
    return NextResponse.json(
      {
        error: "City dataset not available. Run the sync cron first."
      },
      { status: 503 }
    );
  }

  const viewportRadius = boundsMaxDistanceToCenter(bounds);
  let searchRadius = Math.max(radius, viewportRadius, 500);
  let restrictedFeatures = [];
  let source: "google" | "cache" = "cache";
  let cacheMeta:
    | {
        updatedAt?: string;
      }
    | Record<string, unknown>
    | undefined;

  if ((useCityScope || cache) && cache) {
    restrictedFeatures = cache.restricted.filter((feature) => {
      if (!feature.restrictedCategory) return true;
      return requested.includes(feature.restrictedCategory);
    });
    source = "cache";
    searchRadius = cache.meta.radiusMeters;
    cacheMeta = { updatedAt: cache.updatedAt };
  } else {
    try {
      const restrictedPlacesResponse = await queryRestrictedPlaces({
        bounds,
        location: center,
        radiusMeters: searchRadius,
        categories: requested
      });
      restrictedFeatures = restrictedPlacesResponse.features;
      source = restrictedPlacesResponse.source;
      cacheMeta = restrictedPlacesResponse.meta;
    } catch (error) {
      if (error instanceof MissingPlaceDatasetError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      throw error;
    }
  }

  const zones = computeSafeZones(bounds, restrictedFeatures);

  return NextResponse.json({
    zones,
    restrictedCount: restrictedFeatures.length,
    restrictedPlaces: restrictedFeatures,
    meta: {
      categories: requested,
      searchRadius,
      scope: useCityScope ? "city" : "viewport",
      source,
      cache: cacheMeta
    }
  });
}
