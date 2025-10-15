import { NextResponse } from "next/server";
import { z } from "zod";

import { boundsMaxDistanceToCenter, type MapBounds } from "@/lib/geo";
import { computeSafeZones } from "@/lib/club-zones";
import { readCachedPlaces } from "@/lib/storage/place-cache";
import {
  MissingPlaceDatasetError,
  queryRestrictedPlaces
} from "@/lib/services/place-repository";
import { defaultCityId, getCityClubSafeDistance, getCityRestrictedCategories } from "@/lib/config/cities";
import { isPointInsideCity } from "@/lib/land";
import type { RestrictedCategory } from "@/types/map";
import { supportedCityIdsEnum } from "@/types/map";

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
  radius: z.coerce.number().default(1500),
  scope: z.enum(["city"]).optional(),
  city: z.enum(supportedCityIdsEnum).optional(),
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

  const {
    north,
    south,
    east,
    west,
    centerLat,
    centerLng,
    radius,
    categories,
    scope,
    city: requestedCity
  } = parsed.data;
  const bounds: MapBounds = { north, south, east, west };
  const center = { lat: centerLat, lng: centerLng };
  const cityId = requestedCity ?? defaultCityId;

  const cityRestrictedCategories = getCityRestrictedCategories(cityId);
  const allowed = new Set<string>(cityRestrictedCategories);
  const requested = (categories ?? cityRestrictedCategories).filter((category) =>
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

  restrictedFeatures = restrictedFeatures.filter((feature) =>
    isPointInsideCity(cityId, feature.location)
  );

  const zones = computeSafeZones(restrictedFeatures, {
    cityId,
    bufferDistanceMeters: getCityClubSafeDistance(cityId)
  });

  return NextResponse.json({
    zones,
    restrictedCount: restrictedFeatures.length,
    restrictedPlaces: restrictedFeatures,
    meta: {
      cityId,
      categories: requested,
      searchRadius,
      scope: useCityScope ? "city" : "viewport",
      source,
      cache: cacheMeta
    }
  });
}
