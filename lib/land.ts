import { cityLandGeometry } from "@/data/land";
import { degreesToRadians, pointInPolygon, type LatLngLiteral } from "@/lib/geo";
import type { CityId } from "@/types/map";

type Coordinate = [number, number];
type Ring = Coordinate[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

const landCache = new Map<CityId, MultiPolygon>();
const landLatLngCache = new Map<CityId, LatLngLiteral[][][]>();

function loadCityLand(cityId: CityId): MultiPolygon {
  const cached = landCache.get(cityId);
  if (cached) {
    return cached;
  }

  const geometry = cityLandGeometry[cityId];
  if (!geometry) {
    throw new Error(`Land geometry not configured for city ${cityId}`);
  }

  const polygons: MultiPolygon = [];

  for (const feature of geometry.features ?? []) {
    const { geometry: featureGeometry } = feature;
    if (!featureGeometry) continue;

    if (featureGeometry.type === "Polygon") {
      const coordinates = featureGeometry.coordinates as unknown as Coordinate[][];
      polygons.push(normalizePolygon(coordinates));
    } else if (featureGeometry.type === "MultiPolygon") {
      const coordinates = featureGeometry.coordinates as unknown as Coordinate[][][];
      for (const polygon of coordinates) {
        polygons.push(normalizePolygon(polygon));
      }
    }
  }

  landCache.set(cityId, polygons);
  return polygons;
}

function normalizePolygon(polygon: Ring[]): Polygon {
  return polygon.map((ring) => {
    if (ring.length === 0) return ring;
    const [firstLng, firstLat] = ring[0];
    const [lastLng, lastLat] = ring[ring.length - 1];
    if (firstLng === lastLng && firstLat === lastLat) {
      return ring;
    }
    return [...ring, [firstLng, firstLat]];
  });
}

export function getLandMultiPolygon(cityId: CityId): MultiPolygon {
  const polygons = loadCityLand(cityId);
  if (polygons.length === 0) return [];
  return polygons;
}

export function multiPolygonToLatLng(polygons: MultiPolygon): LatLngLiteral[][][] {
  return polygons.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([lng, lat]) => ({
        lat,
        lng
      }))
    )
  );
}

function getLandLatLngPolygons(cityId: CityId): LatLngLiteral[][][] {
  const cached = landLatLngCache.get(cityId);
  if (cached) {
    return cached;
  }

  const latLngPolygons = multiPolygonToLatLng(getLandMultiPolygon(cityId));
  landLatLngCache.set(cityId, latLngPolygons);
  return latLngPolygons;
}

export function isPointInsideCity(cityId: CityId, point: LatLngLiteral) {
  const polygons = getLandLatLngPolygons(cityId);
  return polygons.some((polygon) => {
    if (polygon.length === 0) return false;
    const [outer, ...holes] = polygon;
    if (!pointInPolygon(point, outer)) return false;
    return holes.every((hole) => !pointInPolygon(point, hole));
  });
}

export function latLngToRing(points: LatLngLiteral[]): Ring {
  const ring: Ring = points.map((point) => [point.lng, point.lat]);
  if (ring.length === 0) return ring;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) {
    return ring;
  }
  return [...ring, [firstLng, firstLat]];
}

export function ringAreaSquareMeters(ring: LatLngLiteral[]) {
  if (ring.length < 4) return 0;
  const refLat =
    ring.reduce((sum, point) => sum + point.lat, 0) / Math.max(ring.length, 1);
  const refLng =
    ring.reduce((sum, point) => sum + point.lng, 0) / Math.max(ring.length, 1);

  const metersPerDegreeLat = 111_132;
  const metersPerDegreeLng =
    111_320 * Math.max(Math.cos(degreesToRadians(refLat)), 1e-6);

  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    const x1 = (p1.lng - refLng) * metersPerDegreeLng;
    const y1 = (p1.lat - refLat) * metersPerDegreeLat;
    const x2 = (p2.lng - refLng) * metersPerDegreeLng;
    const y2 = (p2.lat - refLat) * metersPerDegreeLat;
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}
