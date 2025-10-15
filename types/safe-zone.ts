import type { LatLngLiteral } from "@/lib/geo";

export type SafeZone = {
  cellId: string;
  center: LatLngLiteral;
  polygon: LatLngLiteral[];
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
