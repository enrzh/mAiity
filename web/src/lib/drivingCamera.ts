import type { LngLat } from './navigation'
import type { DrivingSession } from './drivingSession'
import { bearingAtProgress, pointAtProgress } from './driving'

/**
 * Close third-person chase: car stays visible lower-center, road opens ahead.
 */
export const RACE_PITCH = 68
export const RACE_ZOOM = 18.2
export const RACE_ALTITUDE_M = 95
export const RACE_ALTITUDE_READY_M = 140
export const RACE_CAM_BACK_M = 14
export const RACE_LOOKAHEAD_M = 32
export const RACE_LOOKAHEAD_READY_M = 18
export const RACE_LOOKAHEAD = 0.012
export const RACE_LANE_M = 3.2

export interface RaceCamera {
  center: LngLat
  bearing: number
  pitch: number
  zoom: number
  altitudeM: number
}

export interface VehiclePose {
  lon: number
  lat: number
  heading: number
}

export function offsetAlongBearing(point: LngLat, bearingDeg: number, meters: number): LngLat {
  const rad = (bearingDeg * Math.PI) / 180
  const dLat = (meters / 111_320) * Math.cos(rad)
  const dLon = (meters / (111_320 * Math.max(0.2, Math.cos((point[1] * Math.PI) / 180)))) * Math.sin(rad)
  return [point[0] + dLon, point[1] + dLat]
}

export function offsetLateral(point: LngLat, bearingDeg: number, meters: number): LngLat {
  return offsetAlongBearing(point, bearingDeg + 90, meters)
}

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

/** Live vehicle pose from free-drive fields or route progress. */
export function vehiclePoseFromSession(
  session: DrivingSession,
  routeGeometry?: [number, number][] | null,
): VehiclePose | null {
  if (session.status === 'idle') return null
  if (session.kind === 'free') {
    if (!Number.isFinite(session.lon) || !Number.isFinite(session.lat)) return null
    return { lon: session.lon, lat: session.lat, heading: session.heading }
  }
  if (!routeGeometry || routeGeometry.length < 2) {
    if (Number.isFinite(session.lon) && Number.isFinite(session.lat) && (session.lon !== 0 || session.lat !== 0)) {
      return { lon: session.lon, lat: session.lat, heading: session.heading }
    }
    return null
  }
  const point = pointAtProgress(routeGeometry, session.progress)
  const bearing = bearingAtProgress(routeGeometry, session.progress)
  const car = carPositionAt(point, bearing, session.lateral ?? 0)
  return { lon: car[0], lat: car[1], heading: bearing }
}

/**
 * Chase camera: look ahead of the car so the vehicle sits in the lower frame
 * (matches the Three.js car overlay anchor).
 */
export function raceCameraAt(
  point: LngLat,
  bearingDeg: number,
  opts?: { pitch?: number; zoom?: number; altitudeM?: number; lookAheadM?: number; backM?: number },
): RaceCamera {
  const lookAheadM = opts?.lookAheadM ?? RACE_LOOKAHEAD_M
  const look = offsetAlongBearing(point, bearingDeg, lookAheadM)
  return {
    center: look,
    bearing: bearingDeg,
    pitch: opts?.pitch ?? RACE_PITCH,
    zoom: opts?.zoom ?? RACE_ZOOM,
    altitudeM: opts?.altitudeM ?? RACE_ALTITUDE_M,
  }
}
