"use client";

import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  PolygonF,
  useLoadScript
} from "@react-google-maps/api";
import { Badge, Card, CardBody, CardHeader, Divider, Spinner } from "@heroui/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { cannabisCategoryOptions } from "@/lib/constants/categories";
import { boundsFromCenter, type LatLngLiteral, type MapBounds } from "@/lib/geo";
import { safeZoneCacheKey } from "@/lib/safe-zone-key";
import type { MapFilterState } from "@/types/map";
import type { PlaceFeature } from "@/types/places";
import type { SafeZone, SafeZoneResponse } from "@/types/safe-zone";

type GrowMapProps = {
  filters: MapFilterState;
};

type MapBoundsState = MapBounds;

type PlacesApiResponse = {
  cannabis: PlaceFeature[];
  restricted: PlaceFeature[];
  source: string;
  meta?: Record<string, unknown>;
};

const MAP_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [
  "places",
  "geometry"
];
const MIN_ZOOM_LEVEL = 13;
const MAX_ZOOM_LEVEL = 18;
const MARKER_RENDER_LIMIT = 250;
const SAFE_ZONE_ZOOM_THRESHOLD = 13;
const VIEWPORT_FETCH_ZOOM_THRESHOLD = 13;
const DEFAULT_CENTER = parseDefaultCenter();
const INITIAL_RADIUS_METERS = 1500;
const DEFAULT_ZOOM_LEVEL = 14;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

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
      paths={zone.paths}
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
  const initialBounds = useMemo(
    () => boundsFromCenter(DEFAULT_CENTER, INITIAL_RADIUS_METERS),
    []
  );
  const [mapBounds, setMapBounds] = useState<MapBoundsState | null>(initialBounds);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM_LEVEL);
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

  useEffect(() => {
    if (mapRef.current) return;
    setMapBounds(initialBounds);
  }, [initialBounds]);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      const mapCenter = map.getCenter();
      if (mapCenter) {
        const currentCenter = { lat: mapCenter.lat(), lng: mapCenter.lng() };
        setCenter(currentCenter);
        const bounds = map.getBounds();
        if (bounds) {
          setMapBounds(extractBounds(bounds));
        } else {
          setMapBounds(boundsFromCenter(currentCenter, INITIAL_RADIUS_METERS));
        }
      } else {
        setMapBounds(initialBounds);
      }
      const zoom = map.getZoom();
      const targetZoom =
        typeof zoom === "number"
          ? Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, zoom))
          : DEFAULT_ZOOM_LEVEL;
      map.setZoom(targetZoom);
      setMapZoom(targetZoom);
    },
    [initialBounds]
  );

  const onMapIdle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const mapCenter = map.getCenter();
    const zoom = map.getZoom();
    if (typeof zoom === "number") {
      const clampedZoom = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, zoom));
      if (clampedZoom !== zoom) {
        map.setZoom(clampedZoom);
      }
      setMapZoom(clampedZoom);
    }
    if (mapCenter) {
      setCenter({ lat: mapCenter.lat(), lng: mapCenter.lng() });
    }
    if (bounds) {
      setMapBounds(extractBounds(bounds));
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      setCenter(DEFAULT_CENTER);
      setMapBounds(boundsFromCenter(DEFAULT_CENTER, INITIAL_RADIUS_METERS));
      setMapZoom(DEFAULT_ZOOM_LEVEL);
      return;
    }
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM_LEVEL);
    setCenter(DEFAULT_CENTER);
    setMapBounds(boundsFromCenter(DEFAULT_CENTER, INITIAL_RADIUS_METERS));
    setMapZoom(DEFAULT_ZOOM_LEVEL);
  }, [filters.cityId]);

  const placesKey = useMemo(
    () => `/api/places?city=${filters.cityId}`,
    [filters.cityId]
  );

  const {
    data: placesData,
    isLoading: placesLoading,
    error: placesError
  } = useSWR(
    placesKey,
    (url) => fetcher<PlacesApiResponse>(url),
    {
      revalidateOnFocus: false
    }
  );

  const safeZonesKey = useMemo(() => {
    if (!filters.showClubEnabledAreas) return null;
    return `/api/safe-zones?city=${filters.cityId}`;
  }, [filters.cityId, filters.showClubEnabledAreas]);

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

  const filteredCannabisByCategory = useMemo(() => {
    if (!placesData?.cannabis) return [];
    if (filters.cannabisCategories.length === 0) return [];
    const allowed = new Set(filters.cannabisCategories);
    return placesData.cannabis.filter((feature) => {
      const category = feature.cannabisCategory ?? "other";
      return allowed.has(category);
    });
  }, [placesData?.cannabis, filters.cannabisCategories]);

  const cannabisFeatures = useMemo(() => {
    if (!mapBounds) return [];
    return filteredCannabisByCategory.filter((feature) =>
      isWithinViewBounds(feature.location, mapBounds)
    );
  }, [filteredCannabisByCategory, mapBounds]);

  const shouldRenderCannabisMarkers = mapZoom >= VIEWPORT_FETCH_ZOOM_THRESHOLD;

  const visibleCannabisFeatures = useMemo(() => {
    if (!shouldRenderCannabisMarkers) {
      return [];
    }
    if (cannabisFeatures.length <= MARKER_RENDER_LIMIT) {
      return cannabisFeatures;
    }
    if (!selectedFeature || selectedFeature.type !== "cannabis") {
      return cannabisFeatures.slice(0, MARKER_RENDER_LIMIT);
    }
    const selectedIndex = cannabisFeatures.findIndex((feature) => feature.id === selectedFeature.id);
    if (selectedIndex === -1) {
      return cannabisFeatures.slice(0, MARKER_RENDER_LIMIT);
    }
    const subset = cannabisFeatures.slice(0, MARKER_RENDER_LIMIT);
    if (!subset.some((feature) => feature.id === selectedFeature.id)) {
      subset.pop();
      subset.push(cannabisFeatures[selectedIndex]);
    }
    return subset;
  }, [cannabisFeatures, selectedFeature, shouldRenderCannabisMarkers]);

  const filteredRestrictedByCategory = useMemo(() => {
    if (!placesData?.restricted) return [];
    if (filters.restrictedCategories.length === 0) return [];
    const allowed = new Set(filters.restrictedCategories);
    return placesData.restricted.filter(
      (feature) => feature.restrictedCategory && allowed.has(feature.restrictedCategory)
    );
  }, [placesData?.restricted, filters.restrictedCategories]);

  const restrictedFeatures = useMemo(() => {
    if (!mapBounds) return [];
    if (!filters.showClubEnabledAreas) return [];
    if (mapZoom < SAFE_ZONE_ZOOM_THRESHOLD) return [];
    return filteredRestrictedByCategory.filter((feature) =>
      isWithinViewBounds(feature.location, mapBounds)
    );
  }, [filteredRestrictedByCategory, filters.showClubEnabledAreas, mapBounds, mapZoom]);

  const visibleRestrictedFeatures = useMemo(() => {
    if (restrictedFeatures.length <= MARKER_RENDER_LIMIT) {
      return restrictedFeatures;
    }
    if (!selectedFeature || selectedFeature.type !== "restricted") {
      return restrictedFeatures.slice(0, MARKER_RENDER_LIMIT);
    }
    const selectedIndex = restrictedFeatures.findIndex(
      (feature) => feature.id === selectedFeature.id
    );
    if (selectedIndex === -1) {
      return restrictedFeatures.slice(0, MARKER_RENDER_LIMIT);
    }
    const subset = restrictedFeatures.slice(0, MARKER_RENDER_LIMIT);
    if (!subset.some((feature) => feature.id === selectedFeature.id)) {
      subset.pop();
      subset.push(restrictedFeatures[selectedIndex]);
    }
    return subset;
  }, [restrictedFeatures, selectedFeature]);

  const safeZoneVariant = useMemo(() => {
    if (!safeZoneData) return null;
    if (!filters.showClubEnabledAreas) return null;
    const key = safeZoneCacheKey(filters.restrictedCategories);
    return (
      safeZoneData.variants.find((entry) => entry.key === key) ?? safeZoneData.variants[0] ?? null
    );
  }, [filters.restrictedCategories, filters.showClubEnabledAreas, safeZoneData]);

  const safeZones = useMemo(() => {
    if (!filters.showClubEnabledAreas) return [];
    if (mapZoom < SAFE_ZONE_ZOOM_THRESHOLD) return [];
    const zones = safeZoneVariant?.zones ?? [];
    return mapBounds
      ? zones.filter((zone) => isWithinViewBounds(zone.center, mapBounds))
      : zones;
  }, [filters.showClubEnabledAreas, mapBounds, mapZoom, safeZoneVariant?.zones]);

  const categoryCount = useMemo(() => aggregateByCategory(cannabisFeatures), [cannabisFeatures]);

  const hiddenCannabisCount = Math.max(
    0,
    cannabisFeatures.length - visibleCannabisFeatures.length
  );
  const hiddenRestrictedCount = Math.max(
    0,
    restrictedFeatures.length - visibleRestrictedFeatures.length
  );
  const totalSafeZoneCount = filters.showClubEnabledAreas ? safeZoneVariant?.zones.length ?? 0 : 0;
  const hiddenSafeZoneCount = Math.max(0, totalSafeZoneCount - safeZones.length);

  useEffect(() => {
    if (!selectedFeature) return;
    const isVisible =
      selectedFeature.type === "cannabis"
        ? visibleCannabisFeatures.some((feature) => feature.id === selectedFeature.id)
        : visibleRestrictedFeatures.some((feature) => feature.id === selectedFeature.id);
    if (!isVisible) {
      setSelectedFeature(null);
    }
  }, [selectedFeature, visibleCannabisFeatures, visibleRestrictedFeatures]);

  useEffect(() => {
    if (!highlightedZone) return;
    const stillPresent = safeZones.some((zone) => zone.id === highlightedZone.id);
    if (!stillPresent) {
      setHighlightedZone(undefined);
    }
  }, [highlightedZone, safeZones]);

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
        zoom={mapZoom}
        mapContainerStyle={MAP_CONTAINER_STYLE}
        options={mapOptions}
      >
        {visibleCannabisFeatures.map((feature) => (
          <CannabisMarker key={feature.id} feature={feature} onSelect={setSelectedFeature} />
        ))}

        {filters.showClubEnabledAreas &&
          visibleRestrictedFeatures.map((feature) => (
            <RestrictedMarker key={feature.id} feature={feature} onSelect={setSelectedFeature} />
          ))}

        {filters.showClubEnabledAreas &&
          safeZones.map((zone) => (
            <SafeZonePolygon
              key={zone.id}
              zone={zone}
              isHighlighted={highlightedZone?.id === zone.id}
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
          clubZones={totalSafeZoneCount}
          clubZonesLoading={safeZoneLoading}
          categoryCount={categoryCount}
          hiddenCannabisCount={hiddenCannabisCount}
          hiddenRestrictedCount={hiddenRestrictedCount}
          hiddenSafeZoneCount={hiddenSafeZoneCount}
          shouldRenderCannabisMarkers={shouldRenderCannabisMarkers}
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

        {highlightedZone && (
          <Card className="pointer-events-auto max-w-xs bg-content1/90 backdrop-blur">
            <CardHeader className="flex flex-col items-start gap-1">
              <p className="text-tiny uppercase text-foreground-500">Club-enabled area</p>
              <p className="text-small font-medium text-success">
                {Number.isFinite(highlightedZone.minDistanceMeters)
                  ? `${highlightedZone.minDistanceMeters.toFixed(0)} m away from nearest sensitive point`
                  : "No sensitive places within the configured radius"}
              </p>
            </CardHeader>
          </Card>
        )}
      </div>

      {(placesLoading || safeZoneLoading) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-6">
          <div className="pointer-events-auto rounded-large bg-content1/70 px-4 py-2 text-tiny text-foreground-500 shadow-lg">
            {placesLoading && <span>Refreshing place data… </span>}
            {safeZoneLoading && <span>Updating club-enabled zones…</span>}
          </div>
        </div>
      )}

      {(placesError || safeZoneError) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-6">
          <Card className="pointer-events-auto max-w-md bg-danger-100/90 text-danger">
            <CardBody className="space-y-2 text-small">
              <h3 className="font-semibold">Something went wrong while fetching data</h3>
              {placesError && <p>Places data: {String(placesError)}</p>}
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
  categoryCount,
  hiddenCannabisCount,
  hiddenRestrictedCount,
  hiddenSafeZoneCount,
  shouldRenderCannabisMarkers
}: {
  cannabisCount: number;
  restrictedCount: number;
  clubZones: number;
  clubZonesLoading: boolean;
  categoryCount: Record<string, number>;
  hiddenCannabisCount: number;
  hiddenRestrictedCount: number;
  hiddenSafeZoneCount: number;
  shouldRenderCannabisMarkers: boolean;
}) {
  const visibleCannabis = Math.max(0, cannabisCount - hiddenCannabisCount);
  const visibleRestricted = Math.max(0, restrictedCount - hiddenRestrictedCount);
  const visibleClubZones = Math.max(0, clubZones - hiddenSafeZoneCount);

  return (
    <Card className="pointer-events-auto min-w-[260px] bg-content1/90 backdrop-blur">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <p className="text-tiny uppercase text-foreground-500">Live Inventory</p>
          <h2 className="text-large font-semibold">{visibleCannabis} cannabis spots</h2>
          {cannabisCount > 0 && (!shouldRenderCannabisMarkers || hiddenCannabisCount > 0) && (
            <p className="text-tiny text-warning">
              {shouldRenderCannabisMarkers
                ? `Showing ${visibleCannabis} of ${cannabisCount} — zoom or filter to see more.`
                : `Zoom in (>${VIEWPORT_FETCH_ZOOM_THRESHOLD}) to reveal map markers.`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-right text-tiny text-foreground-500">
          <span>
            {visibleRestricted} sensitive places
            {hiddenRestrictedCount > 0 ? ` (+${hiddenRestrictedCount} hidden)` : ""}
          </span>
          <span>
            {clubZonesLoading ? "…" : visibleClubZones} club zones
            {hiddenSafeZoneCount > 0 ? ` (+${hiddenSafeZoneCount} hidden)` : ""}
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
