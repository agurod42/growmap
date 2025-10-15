import type { CannabisCategory, RestrictedCategory } from "@/types/map";

export const cannabisCategoryOptions: Record<CannabisCategory, string> = {
  grow_shop: "Grow Shops",
  dispensary: "Dispensaries",
  medical: "Medical Cannabis",
  headshop: "Headshops & Accessories",
  event: "Events & Experiences",
  other: "Other Cannabis Businesses"
};

export const restrictedCategoryOptions: Record<RestrictedCategory, string> = {
  school: "Schools",
  cultural_center: "Cultural Centers",
  rehab_center: "Rehabilitation Centers"
};

export const cannabisCategoryList = Object.keys(cannabisCategoryOptions) as CannabisCategory[];
export const restrictedCategoryList = Object.keys(
  restrictedCategoryOptions
) as RestrictedCategory[];
