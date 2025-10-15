import { readFileSync } from "fs";
import path from "path";

import { degreesToRadians, type LatLngLiteral, type MapBounds } from "@/lib/geo";

type Coordinate = [number, number];
type Ring = Coordinate[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

const LAND_GEOJSON_PATH = path.join(process.cwd(), "data", "land", "montevideo.geojson");

let cachedLandMultiPolygon: MultiPolygon | null = null;

function loadUruguayLand(): MultiPolygon {
  if (cachedLandMultiPolygon) {
    return cachedLandMultiPolygon;
  }

  const raw = readFileSync(LAND_GEOJSON_PATH, "utf-8");
  const parsed = JSON.parse(raw) as {
    type: string;
    features: Array<{
      geometry: {
        type: "Polygon" | "MultiPolygon";
        coordinates: Coordinate[][] | Coordinate[][][];
      };
    }>;
  };

  const polygons: MultiPolygon = [];

  for (const feature of parsed.features) {
    const { geometry } = feature;
    if (!geometry) continue;

    if (geometry.type === "Polygon") {
      polygons.push(normalizePolygon(geometry.coordinates as Ring[]));
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates as Polygon[]) {
        polygons.push(normalizePolygon(polygon));
      }
    }
  }

  cachedLandMultiPolygon = polygons;
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

export function getLandMultiPolygon(_bounds: MapBounds): MultiPolygon {
  const land = loadUruguayLand();
  if (land.length === 0) return [];

  return normalizeMultiPolygon(land);
}

function normalizeMultiPolygon(polygons: MultiPolygon) {
  return polygons.map((polygon) =>
    polygon.map((ring) => {
      if (ring.length === 0) return ring;
      const [firstLng, firstLat] = ring[0];
      const [lastLng, lastLat] = ring[ring.length - 1];
      if (firstLng === lastLng && firstLat === lastLat) {
        return ring;
      }
      return [...ring, [firstLng, firstLat]];
    })
  );
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
