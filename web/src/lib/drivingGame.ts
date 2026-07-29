export interface DrivingGameState {
  progress: number
  speedMps: number
  lateral: number
}

export interface FreeDriveState {
  lon: number
  lat: number
  heading: number
  speedMps: number
  /** Visual bank -1…1 */
  lateral: number
  /** Metres driven this session */
  distanceM: number
}

export interface DrivingInput {
  throttle: boolean
  brake: boolean
  steer: number
}

/** Route race: progress along a fixed polyline. */
export function stepDrivingGame(
  state: DrivingGameState,
  input: DrivingInput,
  dt: number,
  distanceM: number,
): DrivingGameState {
  const safeDt = Math.min(Math.max(dt, 0), 0.1)
  const acceleration = input.brake ? -16 : input.throttle ? 12 : -2.5
  const speedMps = Math.max(0, Math.min(58, state.speedMps + acceleration * safeDt))
  const lateral = Math.max(-1, Math.min(1, state.lateral + input.steer * safeDt * (0.9 + speedMps / 30)))
  const progress = Math.min(1, state.progress + (speedMps * safeDt) / Math.max(1, distanceM))
  return { progress, speedMps, lateral }
}

/**
 * Free roam: move on the ground plane with throttle / brake / steer.
 * Heading turns faster at low speed, drifts slightly at high speed.
 */
export function stepFreeDrive(
  state: FreeDriveState,
  input: DrivingInput,
  dt: number,
): FreeDriveState {
  const safeDt = Math.min(Math.max(dt, 0), 0.1)
  const acceleration = input.brake ? -18 : input.throttle ? 14 : -3
  const speedMps = Math.max(0, Math.min(62, state.speedMps + acceleration * safeDt))
  // Turn rate (deg/s): snappier when slow, limited when fast
  const turnRate = (input.steer * (95 - Math.min(70, speedMps * 1.1))) * (speedMps > 0.4 || input.throttle ? 1 : 0.15)
  const heading = ((state.heading + turnRate * safeDt) % 360 + 360) % 360
  const lateral = Math.max(-1, Math.min(1, state.lateral * 0.88 + input.steer * 0.22))

  const rad = (heading * Math.PI) / 180
  const dist = speedMps * safeDt
  const dLat = (dist / 111_320) * Math.cos(rad)
  const cosLat = Math.max(0.2, Math.cos((state.lat * Math.PI) / 180))
  const dLon = (dist / (111_320 * cosLat)) * Math.sin(rad)

  return {
    lon: state.lon + dLon,
    lat: Math.max(-85, Math.min(85, state.lat + dLat)),
    heading,
    speedMps,
    lateral,
    distanceM: state.distanceM + dist,
  }
}
