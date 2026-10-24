const METRES_PER_DEGREE_LAT = 111_320;

export interface CampusFence {
  name: string;
  lat: number;
  lng: number;
  /** Half the side of the square: the box reaches this far north, south, east and west. */
  halfSizeM: number;
}

/** Campus fence from wrangler vars (CAMPUS_NAME, CAMPUS_LAT, CAMPUS_LNG, CAMPUS_HALF_SIZE_M). */
export function campusFence(env: Env): CampusFence {
  const fence = {
    name: env.CAMPUS_NAME,
    lat: Number(env.CAMPUS_LAT),
    lng: Number(env.CAMPUS_LNG),
    halfSizeM: Number(env.CAMPUS_HALF_SIZE_M),
  };
  if (![fence.lat, fence.lng, fence.halfSizeM].every(Number.isFinite) || fence.halfSizeM <= 0) {
    throw new Error("CAMPUS_LAT / CAMPUS_LNG / CAMPUS_HALF_SIZE_M are not valid numbers");
  }
  return fence;
}

/**
 * How far (metres) a point is outside a square box centred on (lat, lng) with the given
 * half-size; 0 when inside. Uses a local flat-earth projection, accurate at campus scale.
 */
export function metresOutsideBox(centerLat: number, centerLng: number, halfSizeM: number, lat: number, lng: number): number {
  const north = (lat - centerLat) * METRES_PER_DEGREE_LAT;
  const east = (lng - centerLng) * METRES_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
  const dx = Math.max(0, Math.abs(east) - halfSizeM);
  const dy = Math.max(0, Math.abs(north) - halfSizeM);
  return Math.hypot(dx, dy);
}
