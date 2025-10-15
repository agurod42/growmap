import { computeSafeZones } from "@/lib/club-zones";
import { getCityClubSafeDistance, getCityRestrictedCategories } from "@/lib/config/cities";
import { safeZoneCacheKey } from "@/lib/safe-zone-key";
import { isPointInsideCity } from "@/lib/land";
import type { CityId, RestrictedCategory } from "@/types/map";
import type { PlaceFeature } from "@/types/places";
import type { SafeZoneCacheEntry } from "@/types/safe-zone";

function buildCategorySubsets(categories: RestrictedCategory[]): RestrictedCategory[][] {
  const unique = Array.from(new Set(categories));
  const subsets: RestrictedCategory[][] = [[]];

  for (const category of unique) {
    const existing = subsets.map((subset) => [...subset, category]);
    subsets.push(...existing);
  }

  return subsets.map((subset) => [...subset].sort()) as RestrictedCategory[][];
}

export function buildSafeZoneCache(
  cityId: CityId,
  restrictedPlaces: PlaceFeature[]
): SafeZoneCacheEntry[] {
  const subsets = buildCategorySubsets(getCityRestrictedCategories(cityId));
  const bufferDistanceMeters = getCityClubSafeDistance(cityId);

  return subsets.map((categories) => {
    const filteredPlaces = restrictedPlaces.filter((place) => {
      if (!isPointInsideCity(cityId, place.location)) {
        return false;
      }
      if (!place.restrictedCategory) return true;
      return categories.includes(place.restrictedCategory);
    });

    const zones = computeSafeZones(filteredPlaces, {
      cityId,
      bufferDistanceMeters
    });

    return {
      key: safeZoneCacheKey(categories),
      categories,
      zones,
      meta: {
        bufferDistanceMeters,
        restrictedPlaceCount: filteredPlaces.length
      }
    };
  });
}
