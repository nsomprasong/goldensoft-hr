const EARTH_RADIUS_METERS = 6_371_000;

export type Coordinates = { latitude: number; longitude: number };

export function haversineMeters(from: Coordinates, to: Coordinates): number {
  const radians = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * radians;
  const dLng = (to.longitude - from.longitude) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * radians) *
      Math.cos(to.latitude * radians) *
      Math.sin(dLng / 2) ** 2;
  return (
    EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

export type GeofenceResult = {
  accepted: boolean;
  inside: boolean;
  distanceMeters: number;
  /** Configured radius + GPS uncertainty used for the check. */
  effectiveRadiusMeters: number;
  reason?: "ACCURACY_TOO_LOW" | "OUTSIDE_GEOFENCE";
};

/**
 * Rejects only absurdly imprecise readings. Otherwise expands the fence by
 * GPS uncertainty so a tight pin (e.g. 10–30 m) still works on phones.
 */
export function insideGeofence(
  location: Coordinates,
  reading: Coordinates & { accuracyMeters?: number },
  radiusMeters: number,
  maxAccuracyMeters = 250,
): GeofenceResult {
  const distanceMeters = haversineMeters(location, reading);
  const accuracy =
    reading.accuracyMeters != null && Number.isFinite(reading.accuracyMeters)
      ? Math.max(0, reading.accuracyMeters)
      : 0;

  if (accuracy > maxAccuracyMeters) {
    return {
      accepted: false,
      inside: false,
      distanceMeters,
      effectiveRadiusMeters: radiusMeters,
      reason: "ACCURACY_TOO_LOW",
    };
  }

  // Cap uncertainty credit so a 500 m radius pin does not become kilometers wide.
  const uncertaintyCredit = Math.min(accuracy, 80);
  const effectiveRadiusMeters = Math.max(1, radiusMeters) + uncertaintyCredit;
  const inside = distanceMeters <= effectiveRadiusMeters;
  return {
    accepted: inside,
    inside,
    distanceMeters,
    effectiveRadiusMeters,
    reason: inside ? undefined : "OUTSIDE_GEOFENCE",
  };
}
