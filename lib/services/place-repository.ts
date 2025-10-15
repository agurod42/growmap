import type { CannabisCategory, RestrictedCategory } from "@/types/map";
import type { PlaceFeature, PlacesResponse } from "@/types/places";
import type { LatLngLiteral, MapBounds } from "@/lib/geo";
import { haversineDistance } from "@/lib/geo";
import { readCachedPlaces } from "@/lib/storage/place-cache";

type BaseQueryOptions = {
  location?: LatLngLiteral;
  bounds?: MapBounds;
  radiusMeters?: number;
};

export type CannabisQueryOptions = BaseQueryOptions & {
  categories: CannabisCategory[];
};

export type RestrictedQueryOptions = BaseQueryOptions & {
  categories: RestrictedCategory[];
};

export class MissingPlaceDatasetError extends Error {
  constructor() {
    super("Place dataset not available. Run the sync cron first.");
    this.name = "MissingPlaceDatasetError";
  }
}

type DatasetResult = {
  features: PlaceFeature[];
  updatedAt: string | null;
  radiusMeters: number | null;
  categories: string[];
};

function normalizeRadius(radius?: number) {
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
    return undefined;
  }
  return radius;
}

function isWithinBounds(point: LatLngLiteral, bounds: MapBounds) {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng <= bounds.east &&
    point.lng >= bounds.west
  );
}

function filterFeatures(
  features: PlaceFeature[],
  {
    bounds,
    location,
    radiusMeters
  }: {
    bounds?: MapBounds;
    location?: LatLngLiteral;
    radiusMeters?: number;
  }
) {
  const effectiveRadius = normalizeRadius(radiusMeters);
  return features.filter((feature) => {
    if (bounds && !isWithinBounds(feature.location, bounds)) {
      return false;
    }

    if (location && effectiveRadius) {
      const distanceMeters = haversineDistance(location, feature.location) * 1000;
      if (distanceMeters > effectiveRadius) {
        return false;
      }
    }

    return true;
  });
}

async function getDataset(type: "cannabis" | "restricted"): Promise<DatasetResult | null> {
  const dataset = await readCachedPlaces();

  if (dataset) {
    const features = type === "cannabis" ? dataset.cannabis : dataset.restricted;
    const categories =
      type === "cannabis"
        ? dataset.meta.cannabisCategories
        : dataset.meta.restrictedCategories;

    return {
      features,
      updatedAt: dataset.updatedAt,
      radiusMeters: dataset.meta.radiusMeters,
      categories
    };
  }

  return null;
}

function filterByCategories<TCategory extends CannabisCategory | RestrictedCategory>(
  features: PlaceFeature[],
  categories: TCategory[],
  type: "cannabis" | "restricted"
) {
  if (!categories.length) {
    return features;
  }

  const allowed = new Set(categories);
  return features.filter((feature) => {
    if (type === "cannabis") {
      return feature.cannabisCategory && allowed.has(feature.cannabisCategory as TCategory);
    }
    return feature.restrictedCategory && allowed.has(feature.restrictedCategory as TCategory);
  });
}

async function queryPlaces<TCategory extends CannabisCategory | RestrictedCategory>(
  type: "cannabis" | "restricted",
  options: BaseQueryOptions & { categories: TCategory[] }
): Promise<PlacesResponse> {
  const dataset = await getDataset(type);
  if (!dataset) {
    throw new MissingPlaceDatasetError();
  }
  const byCategory = filterByCategories(dataset.features, options.categories, type);
  const filtered = filterFeatures(byCategory, {
    bounds: options.bounds,
    location: options.location,
    radiusMeters: options.radiusMeters
  });

  return {
    features: filtered,
    source: "cache",
    meta: {
      datasetUpdatedAt: dataset.updatedAt,
      datasetRadiusMeters: dataset.radiusMeters,
      requestedRadiusMeters: options.radiusMeters,
      categories: options.categories,
      bounds: options.bounds
    }
  };
}

export async function queryCannabisPlaces(
  options: CannabisQueryOptions
): Promise<PlacesResponse> {
  return queryPlaces("cannabis", options);
}

export async function queryRestrictedPlaces(
  options: RestrictedQueryOptions
): Promise<PlacesResponse> {
  return queryPlaces("restricted", options);
}
