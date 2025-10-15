import { cellToBoundary, cellToLatLng, latLngToCell, polygonToCells } from "h3-js";

export type LatLngLiteral = {
  lat: number;
  lng: number;
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export function haversineDistance(a: LatLngLiteral, b: LatLngLiteral) {
  const EARTH_RADIUS_KM = 6371;
  const dLat = degreesToRadians(b.lat - a.lat);
  const dLon = degreesToRadians(b.lng - a.lng);
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);

  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  return EARTH_RADIUS_KM * c;
}

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function boundsToPolygon(bounds: MapBounds): LatLngLiteral[] {
  return [
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.south, lng: bounds.west },
    { lat: bounds.north, lng: bounds.west }
  ];
}

export function boundsCenter(bounds: MapBounds): LatLngLiteral {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };
}

export function approximateBoundsRadius(bounds: MapBounds): number {
  const center = boundsCenter(bounds);
  const northPoint = { lat: bounds.north, lng: center.lng };
  return haversineDistance(center, northPoint) * 1000;
}

export function boundsFromCenter(center: LatLngLiteral, radiusMeters: number): MapBounds {
  const latMultiplier = radiusMeters / 111320;
  const cosLat = Math.cos(degreesToRadians(center.lat));
  const lngDivider = Math.max(cosLat, 1e-6);
  const lngMultiplier = radiusMeters / (111320 * lngDivider);

  return {
    north: center.lat + latMultiplier,
    south: center.lat - latMultiplier,
    east: center.lng + lngMultiplier,
    west: center.lng - lngMultiplier
  };
}

export function boundsMaxDistanceToCenter(bounds: MapBounds): number {
  const center = boundsCenter(bounds);
  const corners = [
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.south, lng: bounds.west }
  ];

  return corners.reduce((max, corner) => {
    const distanceMeters = haversineDistance(center, corner) * 1000;
    return Math.max(max, distanceMeters);
  }, 0);
}

export function partitionBounds(bounds: MapBounds, rows: number, cols: number): MapBounds[] {
  if (rows <= 0 || cols <= 0) {
    throw new Error("rows and cols must be positive");
  }

  const latStep = (bounds.north - bounds.south) / rows;
  const lngStep = (bounds.east - bounds.west) / cols;
  const segments: MapBounds[] = [];

  for (let row = 0; row < rows; row += 1) {
    const segmentSouth = bounds.south + row * latStep;
    const segmentNorth = row === rows - 1 ? bounds.north : segmentSouth + latStep;

    for (let col = 0; col < cols; col += 1) {
      const segmentWest = bounds.west + col * lngStep;
      const segmentEast = col === cols - 1 ? bounds.east : segmentWest + lngStep;

      segments.push({
        north: segmentNorth,
        south: segmentSouth,
        east: segmentEast,
        west: segmentWest
      });
    }
  }

  return segments;
}

export function createHexagonGrid(bounds: MapBounds, resolution = 9) {
  const polygon = boundsToPolygon(bounds).map((point) => [point.lat, point.lng]) as [
    number,
    number
  ][];

  const cells = polygonToCells([polygon], resolution);
  return cells;
}

export function cellToCoordinates(cell: string) {
  // When `formatAsGeoJson` is true, H3 returns coordinates as [lng, lat].
  const polygon = cellToBoundary(cell, true);
  const center = cellToLatLng(cell);
  return {
    polygon: polygon.map(([lng, lat]) => ({ lat, lng })),
    center: { lat: center[0], lng: center[1] }
  };
}

export function pointToCell(position: LatLngLiteral, resolution = 9) {
  return latLngToCell(position.lat, position.lng, resolution);
}

export function pointInPolygon(point: LatLngLiteral, polygon: LatLngLiteral[]) {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    if (yi > point.lat !== yj > point.lat) {
      const denominator = yj - yi;
      if (denominator !== 0) {
        const xIntersect = ((xj - xi) * (point.lat - yi)) / denominator + xi;
        if (point.lng < xIntersect) {
          inside = !inside;
        }
      }
    }
  }

  return inside;
}
