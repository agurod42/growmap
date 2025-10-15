import type { LatLngLiteral } from "@/lib/geo";

export type SafeZone = {
  id: string;
  center: LatLngLiteral;
  paths: LatLngLiteral[][];
  areaSquareMeters: number;
  minDistanceMeters: number;
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
    };
  };
};
