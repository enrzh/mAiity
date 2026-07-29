import type { LngLat } from './navigation'

/** Street-level race camera: high pitch + zoom so buildings fill the view. */
export const RACE_PITCH = 72
export const RACE_ZOOM = 17.6
/** MapKit altitude (meters above ground) for street-level chase cam. */
export const RACE_ALTITUDE_M = 140
export const RACE_ALTITUDE_READY_M = 220
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

/** Lane offset: positive `meters` is to the right of travel direction. */
export function offsetLateral(point: LngLat, bearingDeg: number, meters: number): LngLat {
  return offsetAlongBearing(point, bearingDeg + 90, meters)
}

/** Convert game lateral (-1…1) into meters of lane offset. */
export const RACE_LANE_M = 3.2

export function carPositionAt(
  point: LngLat,
  bearingDeg: number,
  lateral: number,
  laneM = RACE_LANE_M,
): LngLat {
  const clamped = Math.max(-1, Math.min(1, lateral))
  if (Math.abs(clamped) < 1e-4) return point
  return offsetLateral(point, bearingDeg, clamped * laneM)
}
