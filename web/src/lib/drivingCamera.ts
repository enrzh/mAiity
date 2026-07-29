import type { LngLat } from './navigation'

/** Street-level race camera: high pitch + zoom so buildings fill the view. */
export const RACE_PITCH = 72
export const RACE_ZOOM = 17.6
/** Look slightly ahead of the car so the street opens in front of the player. */
export const RACE_LOOKAHEAD = 0.012

export interface RaceCamera {
  center: LngLat
  bearing: number
  pitch: number
  zoom: number
}

/** Build a third-person follow camera along the route. */
export function raceCameraAt(
  point: LngLat,
  bearingDeg: number,
  opts?: { pitch?: number; zoom?: number },
): RaceCamera {
  return {
    center: point,
    bearing: bearingDeg,
    pitch: opts?.pitch ?? RACE_PITCH,
    zoom: opts?.zoom ?? RACE_ZOOM,
  }
}

/** Offset a lng/lat roughly `meters` ahead along a bearing (for look-ahead). */
export function offsetAlongBearing(point: LngLat, bearingDeg: number, meters: number): LngLat {
  const rad = (bearingDeg * Math.PI) / 180
  const dLat = (meters / 111_320) * Math.cos(rad)
  const dLon = (meters / (111_320 * Math.max(0.2, Math.cos((point[1] * Math.PI) / 180)))) * Math.sin(rad)
  return [point[0] + dLon, point[1] + dLat]
}
