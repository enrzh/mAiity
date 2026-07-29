import { bearing, distanceM, type LngLat } from './navigation'

export function distanceAlongGeometry(geometry: LngLat[] | null | undefined): number {
  if (!geometry || geometry.length < 2) return 0
  let total = 0
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1]
    const b = geometry[i]
    if (!a || !b || !Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) continue
    total += distanceM(a, b)
  }
  return total
}

export function pointAtProgress(geometry: LngLat[] | null | undefined, rawProgress: number): LngLat {
  if (!geometry?.length) return [0, 0]
  if (geometry.length === 1) {
    const p = geometry[0]
    return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p : [0, 0]
  }
  const progress = Math.max(0, Math.min(1, rawProgress))
  const target = distanceAlongGeometry(geometry) * progress
  let travelled = 0
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1]
    const b = geometry[i]
    if (!a || !b) continue
    const segment = distanceM(a, b)
    if (travelled + segment >= target) {
      const t = segment === 0 ? 0 : (target - travelled) / segment
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      ]
    }
    travelled += segment
  }
  const last = geometry[geometry.length - 1]
  return last && Number.isFinite(last[0]) && Number.isFinite(last[1]) ? last : [0, 0]
}

export function bearingAtProgress(geometry: LngLat[] | null | undefined, progress: number): number {
  if (!geometry || geometry.length < 2) return 0
  const point = pointAtProgress(geometry, progress)
  const next = pointAtProgress(geometry, Math.min(1, progress + 0.001))
  return bearing(point, next)
}

export function progressForElapsed(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1
  return Math.max(0, Math.min(1, elapsedMs / durationMs))
}
