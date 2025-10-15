"use client";

import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  PolygonF,
  useLoadScript
} from "@react-google-maps/api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner
} from "@heroui/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { cannabisCategoryOptions } from "@/lib/constants/categories";
import type { MapFilterState } from "@/types/map";
import type { PlaceFeature } from "@/types/places";
import type { SafeZone, SafeZoneResponse } from "@/types/safe-zone";

type GrowMapProps = {
  filters: MapFilterState;
};

type MapBoundsState = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const MAP_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [
  "places",
  "geometry"
];
const MIN_ZOOM_LEVEL = 12;
const MAX_ZOOM_LEVEL = 18;
const DEFAULT_CENTER = parseDefaultCenter();
const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "calc(100vh - 120px)"
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  fullscreenControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: true,
  minZoom: MIN_ZOOM_LEVEL,
  maxZoom: MAX_ZOOM_LEVEL,
  styles: [
    {
      featureType: "poi",
      stylers: [{ visibility: "off" }]
    },
    {
      featureType: "transit",
      stylers: [{ visibility: "off" }]
    }
  ]
};

const fetcher = async <T,>(url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

const createMarkerIcon = (color: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='44' viewBox='0 0 32 44'>
    <path fill='${color}' stroke='white' stroke-width='2' d='M16 0c8.6 0 15 6.8 15 15.3 0 10.3-13.4 25.8-14 26.5-.5.6-1.4.6-1.9 0-.6-.7-14-16.2-14-26.5C1 6.8 7.4 0 16 0z'/>
    <circle cx='16' cy='16' r='6' fill='white'/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(32, 44)
  } as google.maps.Icon;
};

function parseDefaultCenter() {
  const fallback = { lat: 41.3851, lng: 2.1734 };
  const envValue = process.env.NEXT_PUBLIC_DEFAULT_LOCATION;
  if (!envValue) return fallback;
  const [lat, lng] = envValue.split(",").map((value) => Number.parseFloat(value.trim()));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return fallback;
}

function extractBounds(bounds: google.maps.LatLngBounds): MapBoundsState {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return {
    north: ne.lat(),
    south: sw.lat(),
    east: ne.lng(),
    west: sw.lng()
  };
}

function formatCoord(value: number) {
  return value.toFixed(6);
}

function isWithinViewBounds(point: { lat: number; lng: number }, bounds: MapBoundsState) {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng <= bounds.east &&
    point.lng >= bounds.west
  );
}

function aggregateByCategory(features: PlaceFeature[]) {
  return features.reduce<Record<string, number>>((accumulator, item) => {
    const key = item.cannabisCategory ?? "other";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function radiusToZoom(radiusMeters: number) {
  const zoom = 14 - Math.log2(radiusMeters / 750);
  return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, zoom));
}

const CannabisMarker = memo(function CannabisMarker({
  feature,
  onSelect
}: {
  feature: PlaceFeature;
  onSelect: (feature: PlaceFeature) => void;
}) {
  const icon = useMemo(() => createMarkerIcon("#22c55e"), []);
  return (
    <MarkerF
      position={feature.location}
      icon={icon}
      onClick={() => onSelect(feature)}
      title={feature.name}
    />
  );
});

const RestrictedMarker = memo(function RestrictedMarker({
  feature,
  onSelect
}: {
  feature: PlaceFeature;
  onSelect: (feature: PlaceFeature) => void;
}) {
  const icon = useMemo(() => createMarkerIcon("#ef4444"), []);
  return (
    <MarkerF
      position={feature.location}
      icon={icon}
      onClick={() => onSelect(feature)}
      title={feature.name}
    />
  );
});

const SafeZonePolygon = memo(function SafeZonePolygon({
  zone,
  isHighlighted,
  onHover
}: {
  zone: SafeZone;
  isHighlighted: boolean;
  onHover: (zone?: SafeZone) => void;
}) {
  return (
    <PolygonF
      paths={zone.polygon}
      options={{
        fillColor: "#22c55e",
        fillOpacity: isHighlighted ? 0.3 : 0.18,
        strokeColor: isHighlighted ? "#16a34a" : "#15803d",
        strokeOpacity: isHighlighted ? 0.6 : 0.35,
        strokeWeight: 1
      }}
      onMouseOver={() => onHover(zone)}
      onMouseOut={() => onHover(undefined)}
    />
  );
});

export default function GrowMap({ filters }: GrowMapProps) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [mapBounds, setMapBounds] = useState<MapBoundsState | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<PlaceFeature | null>(null);
  const [highlightedZone, setHighlightedZone] = useState<SafeZone | undefined>(undefined);
  const mapRef = useRef<google.maps.Map | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey ?? "",
    libraries: MAP_LIBRARIES
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter({ lat: latitude, lng: longitude });
      },
      () => {
        /* fall back silently */
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    const bounds = map.getBounds();
    if (bounds) {
      setMapBounds(extractBounds(bounds));
    }
  }, []);

  const onMapIdle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const mapCenter = map.getCenter();
    if (mapCenter) {
      setCenter({ lat: mapCenter.lat(), lng: mapCenter.lng() });
    }
    if (bounds) {
      setMapBounds(extractBounds(bounds));
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = radiusToZoom(filters.searchRadius);
    map.setZoom(zoom);
  }, [filters.searchRadius]);

  const cannabisKey = useMemo(() => {
    if (filters.cannabisCategories.length === 0) return null;
    const params = new URLSearchParams({
      scope: "city",
      categories: filters.cannabisCategories.join(",")
    });
    return `/api/places?${params.toString()}`;
  }, [filters.cannabisCategories]);

  const {
    data: cannabisData,
    isLoading: cannabisLoading,
    error: cannabisError
  } = useSWR(
    cannabisKey,
    (url) => fetcher<{ features: PlaceFeature[]; source: string; cache?: { hit: boolean } }>(url),
    {
      keepPreviousData: true,
      revalidateOnFocus: false
    }
  );

  const safeZonesKey = useMemo(() => {
    if (!mapBounds) return null;
    if (!filters.showClubEnabledAreas) return null;
    const params = new URLSearchParams({
      north: formatCoord(mapBounds.north),
      south: formatCoord(mapBounds.south),
      east: formatCoord(mapBounds.east),
      west: formatCoord(mapBounds.west),
      centerLat: formatCoord(center.lat),
      centerLng: formatCoord(center.lng),
      radius: String(filters.searchRadius),
      categories: filters.restrictedCategories.join(",")
    });
    params.set("scope", "city");
    return `/api/safe-zones?${params.toString()}`;
  }, [
    center.lat,
    center.lng,
    filters.restrictedCategories,
    filters.searchRadius,
    filters.showClubEnabledAreas,
    mapBounds
  ]);

  const {
    data: safeZoneData,
    isLoading: safeZoneLoading,
    error: safeZoneError
  } = useSWR(
    safeZonesKey,
    (url) => fetcher<SafeZoneResponse>(url),
    {
      revalidateOnFocus: false
    }
  );

  const cannabisFeatures = useMemo(() => {
    const features = cannabisData?.features ?? [];
    if (!mapBounds) return features;
    return features.filter((feature) =>
      isWithinViewBounds(feature.location, mapBounds)
    );
  }, [cannabisData?.features, mapBounds]);

  const restrictedFeatures = useMemo(() => {
    const features = safeZoneData?.restrictedPlaces ?? [];
    if (!mapBounds) return features;
    return features.filter((feature) =>
      isWithinViewBounds(feature.location, mapBounds)
    );
  }, [safeZoneData?.restrictedPlaces, mapBounds]);

  const categoryCount = useMemo(() => aggregateByCategory(cannabisFeatures), [cannabisFeatures]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.panTo(DEFAULT_CENTER);
    mapRef.current.setZoom(radiusToZoom(filters.searchRadius));
  };

  if (!googleMapsApiKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-xl font-semibold">Google Maps API key missing</h2>
        <p className="max-w-md text-small text-foreground-500">
          Set <code>GOOGLE_MAPS_API_KEY</code> and <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to render
          GrowMap.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <h2 className="text-xl font-semibold text-danger">Failed to load Google Maps</h2>
        <p className="text-small text-foreground-500">{String(loadError)}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Loading map..." color="success" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        onLoad={onMapLoad}
        onIdle={onMapIdle}
        center={center}
        zoom={radiusToZoom(filters.searchRadius)}
        mapContainerStyle={MAP_CONTAINER_STYLE}
        options={mapOptions}
      >
        {cannabisFeatures.map((feature) => (
          <CannabisMarker key={feature.id} feature={feature} onSelect={setSelectedFeature} />
        ))}

        {filters.showClubEnabledAreas &&
          restrictedFeatures.map((feature) => (
            <RestrictedMarker key={feature.id} feature={feature} onSelect={setSelectedFeature} />
          ))}

        {filters.showClubEnabledAreas &&
          safeZoneData?.zones.map((zone) => (
            <SafeZonePolygon
              key={zone.cellId}
              zone={zone}
              isHighlighted={highlightedZone?.cellId === zone.cellId}
              onHover={setHighlightedZone}
            />
          ))}

        {selectedFeature && (
          <InfoWindowF
            position={selectedFeature.location}
            onCloseClick={() => setSelectedFeature(null)}
          >
            <div className="max-w-xs space-y-2">
              <div>
                <h3 className="font-semibold text-foreground">{selectedFeature.name}</h3>
                {selectedFeature.address && (
                  <p className="text-tiny text-foreground-500">{selectedFeature.address}</p>
                )}
              </div>
              {selectedFeature.rating && (
                <div className="text-tiny text-foreground-500">
                  Rating {selectedFeature.rating.toFixed(1)} ▪︎ {selectedFeature.userRatingCount ?? 0} reviews
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-tiny text-foreground-500">
                {selectedFeature.websiteUri && (
                  <a
                    href={selectedFeature.websiteUri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-success"
                  >
                    Website
                  </a>
                )}
                {selectedFeature.phoneNumber && <span>{selectedFeature.phoneNumber}</span>}
              </div>
              <Badge
                color={selectedFeature.type === "cannabis" ? "success" : "danger"}
                variant="flat"
              >
                {selectedFeature.type === "cannabis"
                  ? cannabisCategoryOptions[selectedFeature.cannabisCategory ?? "other"] ?? "Cannabis"
                  : selectedFeature.restrictedCategory ?? "Restricted"}
              </Badge>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-3">
        <StatsCard
          cannabisCount={cannabisFeatures.length}
          restrictedCount={restrictedFeatures.length}
          clubZones={safeZoneData?.zones.length ?? 0}
          clubZonesLoading={safeZoneLoading}
          categoryCount={categoryCount}
        />
        <Card className="pointer-events-auto max-w-xs bg-content1/80 backdrop-blur">
          <CardBody className="flex flex-wrap gap-2">
            <Badge color="success" variant="flat">
              Cannabis businesses
            </Badge>
            {filters.showClubEnabledAreas && (
              <Badge color="danger" variant="flat">
                Sensitive locations
              </Badge>
            )}
            {filters.showClubEnabledAreas && (
              <Badge color="success" variant="flat">
                Club-enabled zones
              </Badge>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="pointer-events-auto absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3">
        <Button color="success" variant="flat" onPress={handleRecenter} size="sm">
          Reset view
        </Button>
        {highlightedZone && (
          <Card className="max-w-xs bg-content1/90 backdrop-blur">
            <CardHeader className="flex flex-col items-start gap-1">
              <p className="text-tiny uppercase text-foreground-500">Club-enabled area</p>
              <p className="text-small font-medium text-success">
                {highlightedZone.minDistanceMeters.toFixed(0)} m away from nearest sensitive point
              </p>
            </CardHeader>
          </Card>
        )}
      </div>

      {(cannabisLoading || safeZoneLoading) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-6">
          <div className="pointer-events-auto rounded-large bg-content1/70 px-4 py-2 text-tiny text-foreground-500 shadow-lg">
            {cannabisLoading && <span>Refreshing cannabis data… </span>}
            {safeZoneLoading && <span>Updating club-enabled zones…</span>}
          </div>
        </div>
      )}

      {(cannabisError || safeZoneError) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-6">
          <Card className="pointer-events-auto max-w-md bg-danger-100/90 text-danger">
            <CardBody className="space-y-2 text-small">
              <h3 className="font-semibold">Something went wrong while fetching data</h3>
              {cannabisError && <p>Cannabis data: {String(cannabisError)}</p>}
              {safeZoneError && <p>Safe zone data: {String(safeZoneError)}</p>}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatsCard({
  cannabisCount,
  restrictedCount,
  clubZones,
  clubZonesLoading,
  categoryCount
}: {
  cannabisCount: number;
  restrictedCount: number;
  clubZones: number;
  clubZonesLoading: boolean;
  categoryCount: Record<string, number>;
}) {
  return (
    <Card className="pointer-events-auto min-w-[240px] bg-content1/90 backdrop-blur">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <p className="text-tiny uppercase text-foreground-500">Live Inventory</p>
          <h2 className="text-large font-semibold">{cannabisCount} cannabis spots</h2>
        </div>
        <div className="flex flex-col items-end text-right text-tiny text-foreground-500">
          <span>{restrictedCount} sensitive places</span>
          <span>
            {clubZonesLoading ? "…" : clubZones} club zones
          </span>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="flex flex-col gap-1 text-tiny text-foreground-500">
        {Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .map(([category, count]) => (
            <div key={category} className="flex items-center justify-between">
              <span>
                {cannabisCategoryOptions[category as keyof typeof cannabisCategoryOptions] ??
                  category}
              </span>
              <span className="font-medium text-foreground">{count}</span>
            </div>
          ))}
        {Object.keys(categoryCount).length === 0 && (
          <p>No cannabis data available for the current filters.</p>
        )}
      </CardBody>
    </Card>
  );
}
