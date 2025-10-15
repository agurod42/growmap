import concaveman from "concaveman";
import {
  cellToCoordinates,
  createHexagonGrid,
  degreesToRadians,
  haversineDistance,
  pointInPolygon,
  type LatLngLiteral,
  type MapBounds
} from "./geo";
import type { PlaceFeature } from "@/types/places";
import type { SafeZone } from "@/types/safe-zone";

export const CLUB_SAFE_DISTANCE_METERS = 500;
const CLUSTER_MAX_DISTANCE_METERS = 2500;
const CLUSTER_BUFFER_METERS = 800;

export function computeSafeZones(bounds: MapBounds, restrictedPlaces: PlaceFeature[]) {
  if (restrictedPlaces.length === 0) {
    return [];
  }

  const restrictedBounds = restrictedPlaces.reduce(
    (accumulator, place) => {
      const { lat, lng } = place.location;
      return {
        north: Math.max(accumulator.north, lat),
        south: Math.min(accumulator.south, lat),
        east: Math.max(accumulator.east, lng),
        west: Math.min(accumulator.west, lng)
      };
    },
    {
      north: Number.NEGATIVE_INFINITY,
      south: Number.POSITIVE_INFINITY,
      east: Number.NEGATIVE_INFINITY,
      west: Number.POSITIVE_INFINITY
    }
  );

  const referenceLat =
    restrictedPlaces.reduce((sum, place) => sum + place.location.lat, 0) /
    restrictedPlaces.length;

  const latMarginDegrees = CLUB_SAFE_DISTANCE_METERS / 111320;
  const lngMarginDegrees =
    CLUB_SAFE_DISTANCE_METERS /
    (111320 * Math.max(Math.cos(degreesToRadians(referenceLat)), 1e-6));

  const expandedRestrictedBounds = {
    north: restrictedBounds.north + latMarginDegrees,
    south: restrictedBounds.south - latMarginDegrees,
    east: restrictedBounds.east + lngMarginDegrees,
    west: restrictedBounds.west - lngMarginDegrees
  };

  const landPolygons = buildLandPolygons(restrictedPlaces);

  const grid = createHexagonGrid(bounds, 9);
  const zones: SafeZone[] = [];

  for (const cell of grid) {
    const { center, polygon } = cellToCoordinates(cell);

    const outsideExpandedBounds =
      polygon.every((point) => point.lat < expandedRestrictedBounds.south) ||
      polygon.every((point) => point.lat > expandedRestrictedBounds.north) ||
      polygon.every((point) => point.lng < expandedRestrictedBounds.west) ||
      polygon.every((point) => point.lng > expandedRestrictedBounds.east);

    if (outsideExpandedBounds) {
      continue;
    }

    const intersectsLand =
      landPolygons.length === 0
        ? true
        : landPolygons.some((landPolygon) => {
            if (pointInPolygon(center, landPolygon)) {
              return true;
            }
            if (polygon.some((vertex) => pointInPolygon(vertex, landPolygon))) {
              return true;
            }
            return landPolygon.some((vertex) => pointInPolygon(vertex, polygon));
          });

    if (!intersectsLand) {
      continue;
    }

    const minDistanceMeters = restrictedPlaces.reduce((distance, place) => {
      const delta =
        haversineDistance(center, place.location) * 1000; /* convert km to meters */
      return Math.min(distance, delta);
    }, Number.POSITIVE_INFINITY);

    if (minDistanceMeters >= CLUB_SAFE_DISTANCE_METERS) {
      zones.push({
        cellId: cell,
        center,
        polygon,
        minDistanceMeters
      });
    }
  }

  return zones;
}

function buildLandPolygons(restrictedPlaces: PlaceFeature[]) {
  const polygons: LatLngLiteral[][] = [];
  if (restrictedPlaces.length === 0) {
    return polygons;
  }

  const visited = new Array(restrictedPlaces.length).fill(false);

  for (let i = 0; i < restrictedPlaces.length; i += 1) {
    if (visited[i]) continue;
    const clusterIndices: number[] = [];
    const queue: number[] = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const current = queue.pop() as number;
      clusterIndices.push(current);
      const currentLocation = restrictedPlaces[current].location;

      for (let j = 0; j < restrictedPlaces.length; j += 1) {
        if (visited[j]) continue;
        const distanceMeters =
          haversineDistance(currentLocation, restrictedPlaces[j].location) * 1000;
        if (distanceMeters <= CLUSTER_MAX_DISTANCE_METERS) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }

    const clusterPoints = clusterIndices.map((index) => restrictedPlaces[index].location);

    if (clusterPoints.length >= 3) {
      const hull = concaveman(
        clusterPoints.map((point) => [point.lng, point.lat]),
        1.1,
        24
      );
      if (hull.length >= 3) {
        polygons.push(hull.map(([lng, lat]) => ({ lat, lng })));
        continue;
      }
    }

    const fallbackPolygon = createBufferedBoundingPolygon(clusterPoints, CLUSTER_BUFFER_METERS);
    polygons.push(fallbackPolygon);
  }

  return polygons;
}

function createBufferedBoundingPolygon(points: LatLngLiteral[], bufferMeters: number) {
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));
  const referenceLat =
    points.reduce((sum, point) => sum + point.lat, 0) / Math.max(points.length, 1);
  const latBufferDegrees = bufferMeters / 111320;
  const lngBufferDegrees =
    bufferMeters /
    (111320 * Math.max(Math.cos(degreesToRadians(referenceLat)), 1e-6));

  return [
    { lat: minLat - latBufferDegrees, lng: minLng - lngBufferDegrees },
    { lat: minLat - latBufferDegrees, lng: maxLng + lngBufferDegrees },
    { lat: maxLat + latBufferDegrees, lng: maxLng + lngBufferDegrees },
    { lat: maxLat + latBufferDegrees, lng: minLng - lngBufferDegrees }
  ];
}
