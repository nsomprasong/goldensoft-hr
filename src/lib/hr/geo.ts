const EARTH_RADIUS_METERS = 6_371_000;

export type Coordinates = { latitude: number; longitude: number };

export function haversineMeters(from: Coordinates, to: Coordinates): number {
  const radians = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * radians;
  const dLng = (to.longitude - from.longitude) * radians;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeofenceResult = {
  accepted: boolean;
  inside: boolean;
  distanceMeters: number;
  reason?: "ACCURACY_TOO_LOW" | "OUTSIDE_GEOFENCE";
};

/** Rejects imprecise device readings before evaluating the geofence. */
export function insideGeofence(
  location: Coordinates,
  reading: Coordinates & { accuracyMeters?: number },
  radiusMeters: number,
  maxAccuracyMeters = 100,
): GeofenceResult {
  const distanceMeters = haversineMeters(location, reading);
  if (reading.accuracyMeters != null && reading.accuracyMeters > maxAccuracyMeters) {
    return { accepted: false, inside: false, distanceMeters, reason: "ACCURACY_TOO_LOW" };
  }
  const inside = distanceMeters <= radiusMeters;
  return { accepted: inside, inside, distanceMeters, reason: inside ? undefined : "OUTSIDE_GEOFENCE" };
}
