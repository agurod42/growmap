import { z } from "zod";

import {
  cannabisCategoryList,
  restrictedCategoryList,
  cannabisCategoryOptions,
  restrictedCategoryOptions
} from "@/lib/constants/categories";
import {
  createDefaultFiltersForCity,
  defaultCityId
} from "@/lib/config/cities";
import {
  MapFilterState,
  supportedCityIds,
  type CannabisCategory,
  type CityId,
  type RestrictedCategory
} from "@/types/map";

const cannabisEnum = z.enum(
  cannabisCategoryList as [CannabisCategory, ...CannabisCategory[]]
);
const restrictedEnum = z.enum(
  restrictedCategoryList as [RestrictedCategory, ...RestrictedCategory[]]
);

export const filterSchema = z.object({
  cityId: z.enum(supportedCityIds as [CityId, ...CityId[]]),
  cannabisCategories: z.array(cannabisEnum),
  restrictedCategories: z.array(restrictedEnum),
  showClubEnabledAreas: z.boolean(),
  searchRadius: z.number().min(100).max(5000)
});

export const defaultFilterState: MapFilterState = createDefaultFiltersForCity(defaultCityId);

export { cannabisCategoryOptions, restrictedCategoryOptions };
