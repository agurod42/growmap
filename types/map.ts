export type CannabisCategory =
  | "grow_shop"
  | "dispensary"
  | "medical"
  | "headshop"
  | "event"
  | "other";

export type RestrictedCategory =
  | "charter_school"
  | "cultural_center"
  | "kindergarten"
  | "rehab_center"
  | "school";

export const supportedCityIds = ["montevideo"] as const;
export type CityId = (typeof supportedCityIds)[number];

export const supportedCityIdsEnum = [...supportedCityIds] as [CityId, ...CityId[]];

export type ClubZoneMode = "off" | "enabled" | "restricted";

export type MapFilterState = {
  cityId: CityId;
  cannabisCategories: CannabisCategory[];
  restrictedCategories: RestrictedCategory[];
  clubZoneMode: ClubZoneMode;
};
