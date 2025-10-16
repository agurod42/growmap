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
  supportedCityIdsEnum,
  type CannabisCategory,
  type RestrictedCategory
} from "@/types/map";

const cannabisEnum = z.enum(
  cannabisCategoryList as [CannabisCategory, ...CannabisCategory[]]
);
const restrictedEnum = z.enum(
  restrictedCategoryList as [RestrictedCategory, ...RestrictedCategory[]]
);

export const filterSchema = z.object({
  cityId: z.enum(supportedCityIdsEnum),
  cannabisCategories: z.array(cannabisEnum),
  restrictedCategories: z.array(restrictedEnum),
  clubZoneMode: z.enum(["off", "enabled", "restricted"])
});

export const defaultFilterState: MapFilterState = createDefaultFiltersForCity(defaultCityId);

export { cannabisCategoryOptions, restrictedCategoryOptions };
