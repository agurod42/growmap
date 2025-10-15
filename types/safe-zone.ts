import type { LatLngLiteral } from "@/lib/geo";
import type { RestrictedCategory } from "./map";

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
  zones: SafeZone[];
  restrictedCount: number;
  restrictedPlaces: import("@/types/places").PlaceFeature[];
  meta: {
    categories: string[];
    searchRadius: number;
    scope?: "city" | "viewport";
    source: "google" | "cache";
    cache?: {
      hit?: boolean;
      ttlMs?: number;
      updatedAt?: string;
      safeZoneKey?: string;
      safeZoneRestrictedPlaceCount?: number;
      safeZoneCacheHit?: boolean;
    };
  };
};
