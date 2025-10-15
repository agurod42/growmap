import { cellToCoordinates, createHexagonGrid, haversineDistance, type MapBounds } from "./geo";
import type { PlaceFeature } from "@/types/places";
import type { SafeZone } from "@/types/safe-zone";

export const CLUB_SAFE_DISTANCE_METERS = 500;

export function computeSafeZones(bounds: MapBounds, restrictedPlaces: PlaceFeature[]) {
  if (restrictedPlaces.length === 0) {
    return [];
  }

  const grid = createHexagonGrid(bounds, 9);
  const zones: SafeZone[] = [];

  for (const cell of grid) {
    const { center, polygon } = cellToCoordinates(cell);
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
