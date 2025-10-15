export type CannabisCategory =
  | "grow_shop"
  | "dispensary"
  | "medical"
  | "headshop"
  | "event"
  | "other";

export type RestrictedCategory = "school" | "cultural_center" | "rehab_center";

export const supportedCityIds = ["montevideo"] as const;
export type CityId = (typeof supportedCityIds)[number];

export const supportedCityIdsEnum = [...supportedCityIds] as [CityId, ...CityId[]];

export type MapFilterState = {
  cityId: CityId;
  cannabisCategories: CannabisCategory[];
  restrictedCategories: RestrictedCategory[];
  showClubEnabledAreas: boolean;
};
