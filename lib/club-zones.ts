import polygonClipping from "polygon-clipping";

import {
  degreesToRadians,
  haversineDistance,
  radiansToDegrees,
  type LatLngLiteral,
  type MapBounds
} from "@/lib/geo";
import {
  getLandMultiPolygon,
  latLngToRing,
  multiPolygonToLatLng,
  ringAreaSquareMeters
} from "@/lib/land";
import type { PlaceFeature } from "@/types/places";
import type { SafeZone } from "@/types/safe-zone";

export const CLUB_SAFE_DISTANCE_METERS = 500;

const DEFAULT_BUFFER_SEGMENTS = 64;
const MIN_SAFE_ZONE_AREA_SQ_METERS = 5_000;

type Coordinate = [number, number];
type Polygon = Coordinate[][];
type MultiPolygon = Polygon[];

export function computeSafeZones(bounds: MapBounds, restrictedPlaces: PlaceFeature[]) {
  const land = getLandMultiPolygon(bounds);
  if (land.length === 0) {
    return [];
  }

  const relevantPlaces = filterRestrictedPlaces(bounds, restrictedPlaces);

  let allowed: MultiPolygon | null = land;

  if (relevantPlaces.length > 0) {
    const bufferPolygons: Polygon[] = relevantPlaces
      .map((place) => createBufferPolygon(place.location, CLUB_SAFE_DISTANCE_METERS))
      .filter((polygon) => polygon.length > 0)
      .map((ring) => [ring]);
    const mergedBuffers = mergePolygons(bufferPolygons);
    allowed = mergedBuffers
      ? (polygonClipping.difference(land, mergedBuffers) as MultiPolygon | null)
      : land;
  }

  if (!allowed || allowed.length === 0) {
    return [];
  }

  return convertToSafeZones(allowed, restrictedPlaces);
}

function filterRestrictedPlaces(bounds: MapBounds, places: PlaceFeature[]) {
  const latMargin = CLUB_SAFE_DISTANCE_METERS / 111_132;
  const centerLat = (bounds.north + bounds.south) / 2;
  const lngMargin =
    CLUB_SAFE_DISTANCE_METERS / (111_320 * Math.max(Math.cos(degreesToRadians(centerLat)), 1e-6));

  const north = bounds.north + latMargin;
  const south = bounds.south - latMargin;
  const east = bounds.east + lngMargin;
  const west = bounds.west - lngMargin;

  return places.filter((place) => {
    const { lat, lng } = place.location;
    return lat <= north && lat >= south && lng <= east && lng >= west;
  });
}

function createBufferPolygon(center: LatLngLiteral, radiusMeters: number, segments = DEFAULT_BUFFER_SEGMENTS) {
  const points: LatLngLiteral[] = [];
  const radiusEarth = 6_371_000;
  const angularDistance = radiusMeters / radiusEarth;
  const latRad = degreesToRadians(center.lat);
  const lngRad = degreesToRadians(center.lng);

  for (let i = 0; i < segments; i += 1) {
    const bearing = (2 * Math.PI * i) / segments;
    const sinLat = Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing);

    const pointLat = Math.asin(sinLat);
    const pointLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat)
      );

    points.push({
      lat: radiansToDegrees(pointLat),
      lng: normalizeLongitude(radiansToDegrees(pointLng))
    });
  }

  if (points.length === 0) {
    return [];
  }

  return latLngToRing([...points, points[0]]);
}

function mergePolygons(polygons: Polygon[]) {
  if (polygons.length === 0) {
    return null;
  }

  let merged: MultiPolygon = [polygons[0]];
  for (let i = 1; i < polygons.length; i += 1) {
    merged = polygonClipping.union(merged, [polygons[i]]) as MultiPolygon;
  }
  return merged;
}

function convertToSafeZones(polygons: MultiPolygon, restrictedPlaces: PlaceFeature[]): SafeZone[] {
  const safeZones: SafeZone[] = [];
  const latLngPolygons = multiPolygonToLatLng(polygons);

  latLngPolygons.forEach((polygon, index) => {
    if (polygon.length === 0) return;
    const outer = polygon[0];
    if (outer.length < 4) return;

    const areaOuter = ringAreaSquareMeters(outer);
    if (areaOuter < MIN_SAFE_ZONE_AREA_SQ_METERS) return;

    const holesArea = polygon
      .slice(1)
      .reduce((acc, ring) => acc + ringAreaSquareMeters(ring), 0);
    const areaSquareMeters = Math.max(areaOuter - holesArea, 0);
    if (areaSquareMeters < MIN_SAFE_ZONE_AREA_SQ_METERS) return;

    const center = computePolygonCentroid(outer);
    const minDistanceMeters = computeMinDistance(center, restrictedPlaces);

    safeZones.push({
      id: `zone-${index}`,
      center,
      paths: polygon,
      areaSquareMeters,
      minDistanceMeters
    });
  });

  return safeZones;
}

function computePolygonCentroid(ring: LatLngLiteral[]) {
  let areaAccumulator = 0;
  let centroidX = 0;
  let centroidY = 0;
  const refLat =
    ring.reduce((sum, point) => sum + point.lat, 0) / Math.max(ring.length, 1);
  const refLng =
    ring.reduce((sum, point) => sum + point.lng, 0) / Math.max(ring.length, 1);

  const metersPerDegreeLat = 111_132;
  const metersPerDegreeLng =
    111_320 * Math.max(Math.cos(degreesToRadians(refLat)), 1e-6);

  for (let i = 0; i < ring.length - 1; i += 1) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    const x1 = (p1.lng - refLng) * metersPerDegreeLng;
    const y1 = (p1.lat - refLat) * metersPerDegreeLat;
    const x2 = (p2.lng - refLng) * metersPerDegreeLng;
    const y2 = (p2.lat - refLat) * metersPerDegreeLat;
    const cross = x1 * y2 - x2 * y1;
    areaAccumulator += cross;
    centroidX += (x1 + x2) * cross;
    centroidY += (y1 + y2) * cross;
  }

  const area = areaAccumulator / 2;
  if (Math.abs(area) < 1e-6) {
    return ring[0];
  }

  const factor = 1 / (6 * area);
  const centroidMeterX = centroidX * factor;
  const centroidMeterY = centroidY * factor;

  return {
    lat: centroidMeterY / metersPerDegreeLat + refLat,
    lng: centroidMeterX / metersPerDegreeLng + refLng
  };
}

function computeMinDistance(point: LatLngLiteral, places: PlaceFeature[]) {
  return places.reduce((min, place) => {
    const distance = haversineDistance(point, place.location) * 1000;
    return Math.min(min, distance);
  }, Number.POSITIVE_INFINITY);
}

function normalizeLongitude(value: number) {
  if (Number.isNaN(value)) return value;
  let lng = value;
  while (lng > 180) {
    lng -= 360;
  }
  while (lng < -180) {
    lng += 360;
  }
  return lng;
}
