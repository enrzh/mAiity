export interface DrivingGameState {
  progress: number
  speedMps: number
  lateral: number
}

export interface DrivingInput {
  throttle: boolean
  brake: boolean
  steer: number
}

export function stepDrivingGame(
  state: DrivingGameState,
  input: DrivingInput,
  dt: number,
  distanceM: number,
): DrivingGameState {
  const safeDt = Math.min(Math.max(dt, 0), 0.1)
  const acceleration = input.brake ? -14 : input.throttle ? 10 : -3
  const speedMps = Math.max(0, Math.min(55, state.speedMps + acceleration * safeDt))
  const lateral = Math.max(-1, Math.min(1, state.lateral + input.steer * safeDt * (0.8 + speedMps / 35)))
  const progress = Math.min(1, state.progress + (speedMps * safeDt) / Math.max(1, distanceM))
  return { progress, speedMps, lateral }
}
