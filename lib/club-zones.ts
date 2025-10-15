import {
  cellToCoordinates,
  createHexagonGrid,
  degreesToRadians,
  haversineDistance,
  type MapBounds
} from "./geo";
import type { PlaceFeature } from "@/types/places";
import type { SafeZone } from "@/types/safe-zone";

export const CLUB_SAFE_DISTANCE_METERS = 500;

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
