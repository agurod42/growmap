import { env } from "./env";
import {
  CANNABIS_QUERIES,
  PLACE_FIELDS,
  RESTRICTED_QUERIES,
  type PlaceQueryConfig
} from "./config/data-sources";
import {
  boundsCenter,
  boundsMaxDistanceToCenter,
  type LatLngLiteral,
  type MapBounds
} from "./geo";
import type { CannabisCategory, RestrictedCategory } from "@/types/map";
import type { PlaceFeature, PlacesResponse } from "@/types/places";

const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const RESPONSE_FIELD_MASK = PLACE_FIELDS.map((field) => `places.${field}`).join(",");
const CACHE_TTL_MS = 1000 * 60 * 5;

type CacheEntry = {
  timestamp: number;
  data: PlacesResponse;
};

const cannabisCache = new Map<string, CacheEntry>();
const restrictedCache = new Map<string, CacheEntry>();

type PlacesApiPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
};

type PlacesSearchResponse = {
  places?: PlacesApiPlace[];
  nextPageToken?: string;
};

type FetchOptions<TCategory> = {
  bounds?: MapBounds;
  boundsSegments?: MapBounds[];
  location?: LatLngLiteral;
  radius: number;
  categories: TCategory[];
};

function buildCacheKey(
  prefix: string,
  location: LatLngLiteral,
  radius: number,
  categories: readonly string[]
) {
  return [
    prefix,
    location.lat.toFixed(4),
    location.lng.toFixed(4),
    radius,
    categories.slice().sort().join(":")
  ].join("|");
}

function readCache(cache: Map<string, CacheEntry>, key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  const age = Date.now() - entry.timestamp;
  const isFresh = age < CACHE_TTL_MS;
  if (!isFresh) {
    cache.delete(key);
    return undefined;
  }
  return { entry, age };
}

function writeCache(cache: Map<string, CacheEntry>, key: string, data: PlacesResponse) {
  cache.set(key, { timestamp: Date.now(), data });
  return data;
}

async function requestPlaces(
  config: PlaceQueryConfig,
  location: LatLngLiteral,
  radius: number,
  bounds?: MapBounds
) {
  if (!env.GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing Google Maps API key");
  }

  const allPlaces: PlacesApiPlace[] = [];
  let pageToken: string | undefined;
  const seenTokens = new Set<string>();

  while (true) {
    const requestBody: Record<string, unknown> = {
      textQuery: config.textQuery,
      ...(config.type ? { includedType: config.type } : {}),
      pageSize: 20,
      ...(pageToken ? { pageToken } : {})
    };

    if (bounds) {
      requestBody.locationRestriction = {
        rectangle: {
          low: {
            latitude: bounds.south,
            longitude: bounds.west
          },
          high: {
            latitude: bounds.north,
            longitude: bounds.east
          }
        }
      };
    } else {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng
          },
          radius
        }
      };
    }

    const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": RESPONSE_FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places request failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as PlacesSearchResponse;
    allPlaces.push(...(data.places ?? []));
    const nextToken = data.nextPageToken;

    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }

    seenTokens.add(nextToken);
    pageToken = nextToken;

    // Places API may need a short delay before the next page is available.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return allPlaces;
}

function normalizePlace(
  place: PlacesApiPlace,
  category: CannabisCategory | RestrictedCategory,
  type: "cannabis" | "restricted"
): PlaceFeature | undefined {
  if (!place.id || !place.location) {
    return undefined;
  }

  const base: PlaceFeature = {
    id: place.id,
    name: place.displayName?.text ?? "Unknown",
    address: place.formattedAddress,
    location: {
      lat: place.location.latitude,
      lng: place.location.longitude
    },
    categories: place.types ?? [],
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    businessStatus: place.businessStatus,
    websiteUri: place.websiteUri,
    phoneNumber: place.internationalPhoneNumber,
    type
  };

  if (type === "cannabis") {
    return { ...base, cannabisCategory: category as CannabisCategory };
  }

  return { ...base, restrictedCategory: category as RestrictedCategory };
}

function deduplicatePlaces(entries: PlaceFeature[]): PlaceFeature[] {
  const map = new Map<string, PlaceFeature>();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }
  return Array.from(map.values());
}

export async function fetchCannabisPlaces({
  location,
  bounds,
  boundsSegments,
  radius,
  categories
}: FetchOptions<CannabisCategory>): Promise<PlacesResponse> {
  const lookupLocation = location ?? (bounds ? boundsCenter(bounds) : undefined);
  if (!lookupLocation) {
    throw new Error("Location or bounds are required to fetch cannabis places");
  }

  const cacheKey = buildCacheKey("cannabis", lookupLocation, radius, categories);
  const cached = readCache(cannabisCache, cacheKey);
  if (cached) {
    const ttlMs = Math.max(0, CACHE_TTL_MS - cached.age);
    return {
      ...cached.entry.data,
      cache: {
        hit: true,
        ttlMs
      }
    };
  }

  try {
    const segments = boundsSegments?.length
      ? boundsSegments
      : bounds
        ? [bounds]
        : [];

    const tasks: Array<Promise<PlaceFeature[]>> = [];

    if (segments.length === 0) {
      for (const category of categories) {
        const config = CANNABIS_QUERIES[category];
        tasks.push(
          requestPlaces(config, lookupLocation, radius, undefined).then((places) =>
            places
              .map((place) => normalizePlace(place, category, "cannabis"))
              .filter((entry): entry is PlaceFeature => Boolean(entry))
          )
        );
      }
    } else {
      for (const category of categories) {
        const config = CANNABIS_QUERIES[category];
        for (const segment of segments) {
          const segmentCenter = boundsCenter(segment);
          const segmentRadius = Math.max(radius, boundsMaxDistanceToCenter(segment));
          tasks.push(
            requestPlaces(config, segmentCenter, segmentRadius, segment).then((places) =>
              places
                .map((place) => normalizePlace(place, category, "cannabis"))
                .filter((entry): entry is PlaceFeature => Boolean(entry))
            )
          );
        }
      }
    }

    const results = await Promise.all(tasks);

    const response: PlacesResponse = {
      features: deduplicatePlaces(results.flat()),
      source: "google",
      cache: {
        hit: false,
        ttlMs: CACHE_TTL_MS
      }
    };
    writeCache(cannabisCache, cacheKey, response);
    return response;
  } catch (error) {
    console.error("Failed to fetch cannabis places from Google Places.", error);
    throw error;
  }
}

export async function fetchRestrictedPlaces({
  location,
  bounds,
  boundsSegments,
  radius,
  categories
}: FetchOptions<RestrictedCategory>): Promise<PlacesResponse> {
  const lookupLocation = location ?? (bounds ? boundsCenter(bounds) : undefined);
  if (!lookupLocation) {
    throw new Error("Location or bounds are required to fetch restricted places");
  }

  const cacheKey = buildCacheKey("restricted", lookupLocation, radius, categories);
  const cached = readCache(restrictedCache, cacheKey);
  if (cached) {
    const ttlMs = Math.max(0, CACHE_TTL_MS - cached.age);
    return {
      ...cached.entry.data,
      cache: {
        hit: true,
        ttlMs
      }
    };
  }

  try {
    const segments = boundsSegments?.length
      ? boundsSegments
      : bounds
        ? [bounds]
        : [];

    const tasks: Array<Promise<PlaceFeature[]>> = [];

    if (segments.length === 0) {
      for (const category of categories) {
        const config = RESTRICTED_QUERIES[category];
        tasks.push(
          requestPlaces(config, lookupLocation, radius, undefined).then((places) =>
            places
              .map((place) => normalizePlace(place, category, "restricted"))
              .filter((entry): entry is PlaceFeature => Boolean(entry))
          )
        );
      }
    } else {
      for (const category of categories) {
        const config = RESTRICTED_QUERIES[category];
        for (const segment of segments) {
          const segmentCenter = boundsCenter(segment);
          const segmentRadius = Math.max(radius, boundsMaxDistanceToCenter(segment));
          tasks.push(
            requestPlaces(config, segmentCenter, segmentRadius, segment).then((places) =>
              places
                .map((place) => normalizePlace(place, category, "restricted"))
                .filter((entry): entry is PlaceFeature => Boolean(entry))
            )
          );
        }
      }
    }

    const results = await Promise.all(tasks);

    const response: PlacesResponse = {
      features: deduplicatePlaces(results.flat()),
      source: "google",
      cache: {
        hit: false,
        ttlMs: CACHE_TTL_MS
      }
    };
    writeCache(restrictedCache, cacheKey, response);
    return response;
  } catch (error) {
    console.error("Failed to fetch restricted places from Google Places.", error);
    throw error;
  }
}
