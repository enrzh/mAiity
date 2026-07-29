/**
 * Soft 2D building collisions + road bias for free-drive.
 * Uses footprint rings from MapLibre; continuous sweep from prev → next pose.
 */

import { RACE_CAR_RADIUS_M } from './drivingCamera'

export type LngLatTuple = [number, number]

export interface BuildingFootprint {
  ring: LngLatTuple[]
}

export interface RoadSegment {
  a: LngLatTuple
  b: LngLatTuple
}

export interface CollisionPose {
  lon: number
  lat: number
  heading: number
  speedMps: number
}

export interface CollisionResult extends CollisionPose {
  hit: boolean
}

const DEG2RAD = Math.PI / 180

function toLocalM(lon: number, lat: number, originLon: number, originLat: number): [number, number] {
  const cosLat = Math.max(0.2, Math.cos(originLat * DEG2RAD))
  return [(lon - originLon) * 111_320 * cosLat, (lat - originLat) * 111_320]
}

function fromLocalM(x: number, y: number, originLon: number, originLat: number): LngLatTuple {
  const cosLat = Math.max(0.2, Math.cos(originLat * DEG2RAD))
  return [originLon + x / (111_320 * cosLat), originLat + y / 111_320]
}

function ringCentroidLocal(local: [number, number][]): [number, number] {
  let sx = 0, sy = 0
  for (const [x, y] of local) { sx += x; sy += y }
  const n = local.length || 1
  return [sx / n, sy / n]
}

function pointInRing(px: number, py: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function closestOnSeg(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number; dist: number; tx: number; ty: number } {
  const abx = bx - ax, aby = by - ay
  const len2 = abx * abx + aby * aby
  let t = len2 < 1e-12 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const x = ax + abx * t
  const y = ay + aby * t
  const len = Math.sqrt(len2) || 1
  return { x, y, dist: Math.hypot(px - x, py - y), tx: abx / len, ty: aby / len }
}

function ringMinDist(px: number, py: number, local: [number, number][]): {
  dist: number; x: number; y: number; inside: boolean
} {
  const inside = pointInRing(px, py, local)
  let best = { x: px, y: py, dist: Infinity }
  for (let i = 0; i < local.length; i++) {
    const j = (i + 1) % local.length
    const c = closestOnSeg(px, py, local[i][0], local[i][1], local[j][0], local[j][1])
    if (c.dist < best.dist) best = { x: c.x, y: c.y, dist: c.dist }
  }
  return { dist: best.dist, x: best.x, y: best.y, inside }
}

/**
 * Resolve car against buildings. Tests end pose and midpoint of prev→next
 * so high-speed frames cannot tunnel through thin walls.
 */
export function resolveBuildingCollision(
  pose: CollisionPose,
  footprints: BuildingFootprint[],
  carRadiusM = RACE_CAR_RADIUS_M,
  prev?: { lon: number; lat: number } | null,
): CollisionResult {
  if (!footprints.length || !Number.isFinite(pose.lon) || !Number.isFinite(pose.lat)) {
    return { ...pose, hit: false }
  }

  const originLon = pose.lon
  const originLat = pose.lat
  // Precompute local rings once relative to end pose
  const locals: [number, number][][] = []
  for (const fp of footprints) {
    if (!fp.ring || fp.ring.length < 3) continue
    const local: [number, number][] = fp.ring.map(([lon, lat]) =>
      toLocalM(lon, lat, originLon, originLat),
    )
    if (local.length > 1) {
      const a = local[0], b = local[local.length - 1]
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3) local.pop()
    }
    if (local.length >= 3) locals.push(local)
  }
  if (!locals.length) return { ...pose, hit: false }

  // Sample positions along the move (continuous collision)
  const samples: [number, number][] = [[0, 0]]
  if (prev && Number.isFinite(prev.lon) && Number.isFinite(prev.lat)) {
    const [px, py] = toLocalM(prev.lon, prev.lat, originLon, originLat)
    samples.unshift([px, py])
    samples.splice(1, 0, [px * 0.5, py * 0.5]) // midpoint
  }

  let x = 0
  let y = 0
  let hit = false
  const hrad = (pose.heading * Math.PI) / 180
  let vx = Math.sin(hrad) * pose.speedMps
  let vy = Math.cos(hrad) * pose.speedMps

  // Use the first sample that is already inside / too close as starting point
  for (const [sx, sy] of samples) {
    for (const local of locals) {
      const d = ringMinDist(sx, sy, local)
      if (d.inside || d.dist < carRadiusM) {
        x = sx
        y = sy
        hit = true
        break
      }
    }
    if (hit) break
  }

  // Resolve from end pose always
  x = 0
  y = 0
  for (let pass = 0; pass < 4; pass++) {
    let moved = false
    for (const local of locals) {
      const d = ringMinDist(x, y, local)
      if (!(d.inside || d.dist < carRadiusM)) continue
      hit = true
      moved = true
      let nx = x - d.x
      let ny = y - d.y
      let nlen = Math.hypot(nx, ny)
      if (nlen < 1e-5) {
        // Push away from centroid
        const [cx, cy] = ringCentroidLocal(local)
        nx = x - cx
        ny = y - cy
        nlen = Math.hypot(nx, ny) || 1
      }
      nx /= nlen
      ny /= nlen
      if (d.inside) {
        nx = -nx
        ny = -ny
      }
      const push = d.inside ? carRadiusM + 0.6 : (carRadiusM - d.dist + 0.35)
      x = d.x + nx * Math.max(push, carRadiusM + 0.2)
      y = d.y + ny * Math.max(push, carRadiusM + 0.2)
      if (pointInRing(x, y, local)) {
        x += nx * 2
        y += ny * 2
      }
      // Kill into-wall velocity + friction
      const into = vx * nx + vy * ny
      if (into < 0) {
        vx -= into * nx
        vy -= into * ny
      }
      vx *= 0.55
      vy *= 0.55
    }
    if (!moved) break
  }

  if (!hit) return { ...pose, hit: false }

  let speed = Math.hypot(vx, vy)
  speed = Math.min(speed, pose.speedMps * 0.25)
  let heading = pose.heading
  if (speed > 0.5) {
    const slideH = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360
    const dh = ((slideH - pose.heading + 540) % 360) - 180
    heading = ((pose.heading + dh * 0.5) % 360 + 360) % 360
  }

  const [lon, lat] = fromLocalM(x, y, originLon, originLat)
  return { lon, lat, heading, speedMps: speed, hit: true }
}

export function softRoadBias(
  pose: CollisionPose,
  segments: RoadSegment[],
  opts?: { pullM?: number; headingBlend?: number; maxDistM?: number },
): CollisionPose {
  if (!segments.length) return pose
  const pullM = opts?.pullM ?? 0.22
  const headingBlend = opts?.headingBlend ?? 0.05
  const maxDistM = opts?.maxDistM ?? 22

  const originLon = pose.lon
  const originLat = pose.lat
  let bestDist = Infinity
  let bestX = 0
  let bestY = 0
  let bestTx = 0
  let bestTy = 1

  for (const seg of segments) {
    const [ax, ay] = toLocalM(seg.a[0], seg.a[1], originLon, originLat)
    const [bx, by] = toLocalM(seg.b[0], seg.b[1], originLon, originLat)
    const c = closestOnSeg(0, 0, ax, ay, bx, by)
    if (c.dist < bestDist) {
      bestDist = c.dist
      bestX = c.x
      bestY = c.y
      bestTx = c.tx
      bestTy = c.ty
    }
  }

  if (!Number.isFinite(bestDist) || bestDist > maxDistM || bestDist < 0.5) {
    return pose
  }

  const t = Math.min(1, pullM / Math.max(bestDist, 0.5))
  const [lon, lat] = fromLocalM(bestX * t, bestY * t, originLon, originLat)

  let roadH = ((Math.atan2(bestTx, bestTy) * 180) / Math.PI + 360) % 360
  const alt = (roadH + 180) % 360
  const d1 = Math.abs(((roadH - pose.heading + 540) % 360) - 180)
  const d2 = Math.abs(((alt - pose.heading + 540) % 360) - 180)
  if (d2 < d1) roadH = alt
  const dh = ((roadH - pose.heading + 540) % 360) - 180
  const heading = ((pose.heading + dh * headingBlend) % 360 + 360) % 360

  return { lon, lat, heading, speedMps: pose.speedMps }
}

export function footprintsFromFeatures(
  features: Array<{ geometry?: { type?: string; coordinates?: unknown } | null }>,
  max = 64,
): BuildingFootprint[] {
  const out: BuildingFootprint[] = []
  for (const f of features) {
    if (out.length >= max) break
    const g = f.geometry
    if (!g?.coordinates) continue
    if (g.type === 'Polygon') {
      const ring = (g.coordinates as number[][][])[0]
      if (ring && ring.length >= 3) out.push({ ring: ring.map((c) => [c[0], c[1]] as LngLatTuple) })
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as number[][][][]) {
        if (out.length >= max) break
        const ring = poly[0]
        if (ring && ring.length >= 3) out.push({ ring: ring.map((c) => [c[0], c[1]] as LngLatTuple) })
      }
    }
  }
  return out
}

export function roadSegmentsFromFeatures(
  features: Array<{ geometry?: { type?: string; coordinates?: unknown } | null }>,
  maxSegs = 80,
): RoadSegment[] {
  const out: RoadSegment[] = []
  const pushLine = (coords: number[][]) => {
    for (let i = 1; i < coords.length && out.length < maxSegs; i++) {
      const a = coords[i - 1], b = coords[i]
      if (a && b) out.push({ a: [a[0], a[1]], b: [b[0], b[1]] })
    }
  }
  for (const f of features) {
    if (out.length >= maxSegs) break
    const g = f.geometry
    if (!g?.coordinates) continue
    if (g.type === 'LineString') pushLine(g.coordinates as number[][])
    else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates as number[][][]) pushLine(line)
    }
  }
  return out
}
