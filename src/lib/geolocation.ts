import type { GeoPoint } from "../../shared/api";

export type LocationResult = { ok: true; point: GeoPoint } | { ok: false; message: string };

/**
 * Gets the most precise position the device offers within `windowMs`: readings usually
 * sharpen over a few seconds (GPS lock), so we watch and keep the best one, stopping early
 * once it is good enough. Needs HTTPS or localhost.
 */
export function getLocation(windowMs = 8_000, goodEnoughM = 30): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ ok: false, message: "This browser can't share your location. Try a phone browser such as Chrome or Safari." });
      return;
    }
    let best: GeoPoint | null = null;
    let done = false;
    const finish = (result: LocationResult) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
      resolve(result);
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || point.accuracy < best.accuracy) best = point;
        if (point.accuracy <= goodEnoughM) finish({ ok: true, point });
      },
      (err) => {
        if (best) return finish({ ok: true, point: best });
        finish({
          ok: false,
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location access is blocked. Allow it for this site (tap the lock icon in the address bar → Location → Allow), then try again."
              : err.code === err.TIMEOUT
                ? "Getting your location took too long. Turn on GPS/location services and try again."
                : "Your location isn't available right now. Turn on GPS/location services and try again.",
        });
      },
      { enableHighAccuracy: true, timeout: windowMs, maximumAge: 0 },
    );
    const timer = window.setTimeout(
      () =>
        finish(
          best
            ? { ok: true, point: best }
            : { ok: false, message: "Getting your location took too long. Turn on GPS/location services and try again." },
        ),
      windowMs,
    );
  });
}
