import type { LngLat } from './navigation'

/**
 * First-person race camera: driver-eye height on the street, looking forward
 * so buildings and the road fill the frame (not a top-down chase cam).
 */
export const RACE_PITCH = 82
export const RACE_ZOOM = 18.8
/** MapKit altitude (meters AGL) for driver-eye view. */
export const RACE_ALTITUDE_M = 28
export const RACE_ALTITUDE_READY_M = 42
/** Meters the view center sits ahead of the car (road opens in front). */
export const RACE_LOOKAHEAD_M = 22
export const RACE_LOOKAHEAD_READY_M = 14
/** Legacy export — same as ready look-ahead fraction for older call sites. */
export const RACE_LOOKAHEAD = 0.012

export interface RaceCamera {
  center: LngLat
  bearing: number
  pitch: number
  zoom: number
  /** MapKit-only: meters above ground. */
  altitudeM: number
}

/**
 * First-person camera: placed at the car, view aimed slightly down the road.
 * `point` is the car position; we look ahead along `bearingDeg`.
 */
export function raceCameraAt(
  point: LngLat,
  bearingDeg: number,
  opts?: { pitch?: number; zoom?: number; altitudeM?: number; lookAheadM?: number },
): RaceCamera {
  const lookAheadM = opts?.lookAheadM ?? RACE_LOOKAHEAD_M
  const center = offsetAlongBearing(point, bearingDeg, lookAheadM)
  return {
    center,
    bearing: bearingDeg,
    pitch: opts?.pitch ?? RACE_PITCH,
    zoom: opts?.zoom ?? RACE_ZOOM,
    altitudeM: opts?.altitudeM ?? RACE_ALTITUDE_M,
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
