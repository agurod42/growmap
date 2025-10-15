import { cannabisCategoryList, restrictedCategoryList } from "@/lib/constants/categories";
import { defaultCityId } from "@/lib/config/cities";
import { referenceCity } from "@/lib/config/reference-city";
import { fetchCannabisPlaces, fetchRestrictedPlaces } from "@/lib/google-places";
import { buildSafeZoneCache } from "@/lib/services/safe-zone-cache";
import { writeCachedPlaces } from "@/lib/storage/place-cache";

export async function syncReferenceCityPlaces() {
  const { center, bounds, segments, radiusMeters } = referenceCity;

  const [cannabisResponse, restrictedResponse] = await Promise.all([
    fetchCannabisPlaces({
      location: center,
      bounds,
      boundsSegments: segments,
      radius: radiusMeters,
      categories: cannabisCategoryList
    }),
    fetchRestrictedPlaces({
      location: center,
      bounds,
      boundsSegments: segments,
      radius: radiusMeters,
      categories: restrictedCategoryList
    })
  ]);

  const updatedAt = new Date().toISOString();
  const safeZoneCache = buildSafeZoneCache(defaultCityId, restrictedResponse.features);

  await writeCachedPlaces({
    updatedAt,
    cannabis: cannabisResponse.features,
    restricted: restrictedResponse.features,
    safeZoneCache,
    meta: {
      bounds,
      radiusMeters,
      cannabisCategories: cannabisCategoryList,
      restrictedCategories: restrictedCategoryList
    }
  });

  return {
    updatedAt,
    cannabisCount: cannabisResponse.features.length,
    restrictedCount: restrictedResponse.features.length,
    cannabisSource: cannabisResponse.source,
    restrictedSource: restrictedResponse.source,
    safeZoneVariants: safeZoneCache.length
  };
}
