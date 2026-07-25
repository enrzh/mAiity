/// Navigation maths, kept free of React so it can be unit-reasoned about.
/// Everything works on [lon, lat] pairs, matching the route geometry.

export type LngLat = [number, number]

const R = 6_371_000

export function distanceM(a: LngLat, b: LngLat): number {
  const lat = ((a[1] + b[1]) / 2) * Math.PI / 180
  const x = ((b[0] - a[0]) * Math.PI / 180) * Math.cos(lat)
  const y = (b[1] - a[1]) * Math.PI / 180
  return Math.sqrt(x * x + y * y) * R
}

/** Compass bearing a→b in degrees (0 = north), for the follow camera. */
export function bearing(a: LngLat, b: LngLat): number {
  const φ1 = a[1] * Math.PI / 180, φ2 = b[1] * Math.PI / 180
  const Δλ = (b[0] - a[0]) * Math.PI / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

/** Perpendicular distance from p to segment a→b, plus the closest point. */
function pointToSegment(p: LngLat, a: LngLat, b: LngLat): { d: number; t: number } {
  const latScale = Math.cos((p[1] * Math.PI) / 180)
  const ax = a[0] * latScale, ay = a[1]
  const bx = b[0] * latScale, by = b[1]
  const px = p[0] * latScale, py = p[1]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  const cx = ax + t * dx, cy = ay + t * dy
  const ddx = (px - cx) / latScale, ddy = py - cy
  return { d: Math.sqrt((ddx * Math.cos((p[1] * Math.PI) / 180)) ** 2 + ddy * ddy) * (Math.PI / 180) * R, t }
}

export interface Snapped {
  /** Index of the geometry vertex the user is at or just passed. */
  index: number
  /** Metres from the route line — the off-route signal. */
  offRouteM: number
  /** Metres remaining to the end of the route. */
  remainingM: number
}

/// Snap a live position onto the route: which vertex we're at, how far off
/// the line we are, and how much is left. Searching from the last known
/// index forward keeps it O(window) and stops the route "rewinding" when a
/// path crosses itself.
export function snapToRoute(
  pos: LngLat,
  geometry: LngLat[],
  fromIndex = 0,
  window = 400,
): Snapped {
  if (geometry.length < 2) return { index: 0, offRouteM: 0, remainingM: 0 }
  let best = { d: Infinity, i: fromIndex, t: 0 }
  const end = Math.min(geometry.length - 1, fromIndex + window)
  for (let i = Math.max(0, fromIndex); i < end; i++) {
    const { d, t } = pointToSegment(pos, geometry[i], geometry[i + 1])
    if (d < best.d) best = { d, i, t }
  }
  // Remaining = rest of the current segment + every following segment.
  let remaining = distanceM(geometry[best.i], geometry[best.i + 1]) * (1 - best.t)
  for (let i = best.i + 1; i < geometry.length - 1; i++) {
    remaining += distanceM(geometry[i], geometry[i + 1])
  }
  return { index: best.i, offRouteM: best.d, remainingM: remaining }
}

/** The step being driven, given how far along the geometry we are. */
export function currentStep(steps: { beginIdx: number }[], index: number): number {
  let s = 0
  for (let i = 0; i < steps.length; i++) if (steps[i].beginIdx <= index) s = i
  return s
}

/** Metres from the user to the start of the next maneuver. */
export function metresToNextManeuver(
  geometry: LngLat[],
  index: number,
  pos: LngLat,
  nextBeginIdx: number,
): number {
  if (nextBeginIdx <= index) return 0
  let m = distanceM(pos, geometry[Math.min(index + 1, geometry.length - 1)])
  for (let i = index + 1; i < Math.min(nextBeginIdx, geometry.length - 1); i++) {
    m += distanceM(geometry[i], geometry[i + 1])
  }
  return m
}

/** Off-route threshold — generous enough for GPS noise and wide roads. */
export const OFF_ROUTE_M = 45
