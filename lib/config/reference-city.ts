import { env } from "@/lib/env";
import {
  boundsFromCenter,
  partitionBounds,
  type LatLngLiteral,
  type MapBounds
} from "@/lib/geo";

const DEFAULT_REFERENCE_CENTER: LatLngLiteral = { lat: -34.9011, lng: -56.1645 };
const DEFAULT_RADIUS_METERS = 18000;
const DEFAULT_SEGMENTS = 4;

function parseReferenceCenter(): LatLngLiteral {
  const value = env.NEXT_PUBLIC_DEFAULT_LOCATION;
  if (!value) {
    return DEFAULT_REFERENCE_CENTER;
  }

  const [latRaw, lngRaw] = value.split(",");
  const lat = Number.parseFloat(latRaw?.trim() ?? "");
  const lng = Number.parseFloat(lngRaw?.trim() ?? "");

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return DEFAULT_REFERENCE_CENTER;
}

function parseRadius(): number {
  const raw = process.env.REFERENCE_CITY_RADIUS_METERS;
  if (!raw) return DEFAULT_RADIUS_METERS;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_RADIUS_METERS;
}

function parseSegments(): number {
  const raw = process.env.REFERENCE_CITY_SEGMENTS;
  if (!raw) return DEFAULT_SEGMENTS;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
    return parsed;
  }

  return DEFAULT_SEGMENTS;
}

const cityCenter = parseReferenceCenter();
const cityRadiusMeters = parseRadius();
const cityBounds = boundsFromCenter(cityCenter, cityRadiusMeters);
const citySegments = partitionBounds(cityBounds, parseSegments(), parseSegments());

export const referenceCity: {
  center: LatLngLiteral;
  radiusMeters: number;
  bounds: MapBounds;
  segments: MapBounds[];
} = {
  center: cityCenter,
  radiusMeters: cityRadiusMeters,
  bounds: cityBounds,
  segments: citySegments
};
