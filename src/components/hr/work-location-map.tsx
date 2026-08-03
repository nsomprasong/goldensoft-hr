"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };
const DEFAULT_ZOOM = 16;

const pinIcon = L.divIcon({
  className: "hr-location-pin",
  html: '<span class="hr-location-pin-dot" aria-hidden="true"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (disabled) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({
  latitude,
  longitude,
  hasPin,
  focusKey,
}: {
  latitude: number;
  longitude: number;
  hasPin: boolean;
  focusKey: number;
}) {
  const map = useMap();
  const coordsRef = useRef({ latitude, longitude, hasPin });
  coordsRef.current = { latitude, longitude, hasPin };

  useEffect(() => {
    // focusKey 0 = initial mount (MapContainer center already set).
    // Later bumps (GPS / map pick) pan without reacting to every typed digit.
    if (focusKey === 0) return;
    const { latitude: lat, longitude: lng, hasPin: pin } = coordsRef.current;
    if (!pin) return;
    map.setView([lat, lng], Math.max(map.getZoom(), DEFAULT_ZOOM), {
      animate: true,
    });
  }, [focusKey, map]);
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
}

export default function WorkLocationMap({
  latitude,
  longitude,
  radiusMeters,
  disabled = false,
  focusKey = 0,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  disabled?: boolean;
  /** Bump to pan the map to the pin (e.g. after GPS capture). */
  focusKey?: number;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const hasPin =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const centerLat = hasPin ? latitude : DEFAULT_CENTER.lat;
  const centerLng = hasPin ? longitude : DEFAULT_CENTER.lng;
  const radius =
    Number.isFinite(radiusMeters) && radiusMeters >= 1 ? radiusMeters : 50;

  const markerEventHandlers = useMemo(
    () => ({
      dragend: (event: L.DragEndEvent) => {
        if (disabled) return;
        const { lat, lng } = event.target.getLatLng();
        onPick(lat, lng);
      },
      click: (event: L.LeafletMouseEvent) => {
        // Keep map-click from also firing when tapping the pin.
        L.DomEvent.stopPropagation(event);
      },
    }),
    [disabled, onPick],
  );

  return (
    <div className="hr-location-map">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={!disabled}
        className="hr-location-map-canvas"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InvalidateSize />
        <MapClickHandler disabled={disabled} onPick={onPick} />
        <Recenter
          latitude={centerLat}
          longitude={centerLng}
          hasPin={hasPin}
          focusKey={focusKey}
        />
        {hasPin ? (
          <>
            <Circle
              center={[centerLat, centerLng]}
              radius={radius}
              pathOptions={{
                color: "#0f6b5c",
                fillColor: "#0f6b5c",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
            <Marker
              position={[centerLat, centerLng]}
              icon={pinIcon}
              draggable={!disabled}
              eventHandlers={markerEventHandlers}
            />
          </>
        ) : null}
      </MapContainer>
      <p className="muted hr-location-map-hint">
        {disabled
          ? "แสดงหมุดและรัศมีลงเวลา"
          : hasPin
            ? "ลากหมุดหรือคลิกเพื่อย้ายจุด"
            : "คลิกแผนที่เพื่อปักหมุด หรือใช้ตำแหน่งปัจจุบัน"}
      </p>
    </div>
  );
}
