import { bearing, distanceM, type LngLat } from './navigation'

export function distanceAlongGeometry(geometry: LngLat[]): number {
  let total = 0
  for (let i = 1; i < geometry.length; i++) total += distanceM(geometry[i - 1], geometry[i])
  return total
}

export function pointAtProgress(geometry: LngLat[], rawProgress: number): LngLat {
  if (!geometry.length) return [0, 0]
  if (geometry.length === 1) return geometry[0]
  const progress = Math.max(0, Math.min(1, rawProgress))
  const target = distanceAlongGeometry(geometry) * progress
  let travelled = 0
  for (let i = 1; i < geometry.length; i++) {
    const segment = distanceM(geometry[i - 1], geometry[i])
    if (travelled + segment >= target) {
      const t = segment === 0 ? 0 : (target - travelled) / segment
      return [
        geometry[i - 1][0] + (geometry[i][0] - geometry[i - 1][0]) * t,
        geometry[i - 1][1] + (geometry[i][1] - geometry[i - 1][1]) * t,
      ]
    }
    travelled += segment
  }
  return geometry[geometry.length - 1]
}

export function bearingAtProgress(geometry: LngLat[], progress: number): number {
  if (geometry.length < 2) return 0
  const point = pointAtProgress(geometry, progress)
  const next = pointAtProgress(geometry, Math.min(1, progress + 0.001))
  return bearing(point, next)
}

export function progressForElapsed(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1
  return Math.max(0, Math.min(1, elapsedMs / durationMs))
}
