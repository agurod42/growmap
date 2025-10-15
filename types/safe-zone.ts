import type { LatLngLiteral } from "@/lib/geo";
import type { CityId, RestrictedCategory } from "./map";

export type SafeZone = {
  id: string;
  center: LatLngLiteral;
  paths: LatLngLiteral[][];
  areaSquareMeters: number;
  minDistanceMeters: number;
};

export type SafeZoneCacheEntry = {
  key: string;
  categories: RestrictedCategory[];
  zones: SafeZone[];
  meta: {
    bufferDistanceMeters: number;
    restrictedPlaceCount: number;
  };
};

export type SafeZoneResponse = {
  variants: SafeZoneCacheEntry[];
  restrictedCategories: RestrictedCategory[];
  meta: {
    cityId: CityId;
    source: "cache";
    updatedAt?: string;
  };
};
