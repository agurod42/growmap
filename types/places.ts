import { CannabisCategory, RestrictedCategory } from "./map";
import { LatLngLiteral } from "@/lib/geo";

export type PlaceFeature = {
  id: string;
  name: string;
  address?: string;
  location: LatLngLiteral;
  categories: string[];
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  websiteUri?: string;
  phoneNumber?: string;
  type: "cannabis" | "restricted";
  cannabisCategory?: CannabisCategory;
  restrictedCategory?: RestrictedCategory;
};

export type PlacesResponse = {
  features: PlaceFeature[];
  source: "google" | "cache";
  cache?: {
    hit: boolean;
    ttlMs: number;
  };
  meta?: Record<string, unknown>;
};
