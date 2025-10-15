import { z } from "zod";

import {
  cannabisCategoryList,
  restrictedCategoryList,
  cannabisCategoryOptions,
  restrictedCategoryOptions
} from "@/lib/constants/categories";
import { MapFilterState } from "@/types/map";

export const filterSchema = z.object({
  cannabisCategories: z.array(z.enum(cannabisCategoryList)),
  restrictedCategories: z.array(z.enum(restrictedCategoryList)),
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
