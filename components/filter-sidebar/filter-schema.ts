import { z } from "zod";

import {
  cannabisCategoryList,
  restrictedCategoryList,
  cannabisCategoryOptions,
  restrictedCategoryOptions
} from "@/lib/constants/categories";
import { MapFilterState, type CannabisCategory, type RestrictedCategory } from "@/types/map";

const cannabisEnum = z.enum(
  cannabisCategoryList as [CannabisCategory, ...CannabisCategory[]]
);
const restrictedEnum = z.enum(
  restrictedCategoryList as [RestrictedCategory, ...RestrictedCategory[]]
);

export const filterSchema = z.object({
  cannabisCategories: z.array(cannabisEnum),
  restrictedCategories: z.array(restrictedEnum),
  showClubEnabledAreas: z.boolean(),
  searchRadius: z.number().min(100).max(5000)
});

export const defaultFilterState: MapFilterState = {
  cannabisCategories: cannabisCategoryList,
  restrictedCategories: restrictedCategoryList,
  showClubEnabledAreas: true,
  searchRadius: 1500
};

export { cannabisCategoryOptions, restrictedCategoryOptions };
