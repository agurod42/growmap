export type CannabisCategory =
  | "grow_shop"
  | "dispensary"
  | "medical"
  | "headshop"
  | "event"
  | "other";

export type RestrictedCategory = "school" | "cultural_center" | "rehab_center";

export type MapFilterState = {
  cannabisCategories: CannabisCategory[];
  restrictedCategories: RestrictedCategory[];
  showClubEnabledAreas: boolean;
  searchRadius: number;
};
