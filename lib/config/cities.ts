import { cannabisCategoryList } from "@/lib/constants/categories";
import type { MapFilterState, CityId, RestrictedCategory } from "@/types/map";

type CityDefinition = {
  id: CityId;
  name: string;
  country: string;
  displayName: string;
  clubSafeDistanceMeters: number;
  restrictedCategories: RestrictedCategory[];
};

const cityDefinitions: Record<CityId, CityDefinition> = {
  montevideo: {
    id: "montevideo",
    name: "Montevideo",
    country: "Uruguay",
    displayName: "Montevideo, Uruguay",
    clubSafeDistanceMeters: 200,
    restrictedCategories: ["school", "cultural_center", "rehab_center", "kindergarten"]
  }
};

export const defaultCityId: CityId = "montevideo";

export const cityOptions = Object.values(cityDefinitions).map((city) => ({
  id: city.id,
  label: city.displayName
}));

export function getCityDefinition(cityId: CityId): CityDefinition {
  const city = cityDefinitions[cityId];
  if (!city) {
    throw new Error(`City ${cityId} is not configured`);
  }
  return city;
}

export function getCityRestrictedCategories(cityId: CityId): RestrictedCategory[] {
  return [...getCityDefinition(cityId).restrictedCategories];
}

export function getCityClubSafeDistance(cityId: CityId) {
  return getCityDefinition(cityId).clubSafeDistanceMeters;
}

export function createDefaultFiltersForCity(cityId: CityId): MapFilterState {
  const city = getCityDefinition(cityId);
  return {
    cityId,
    cannabisCategories: [...cannabisCategoryList],
    restrictedCategories: [...city.restrictedCategories],
    clubZoneMode: "enabled"
  };
}
