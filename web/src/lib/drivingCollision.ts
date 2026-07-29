/**
 * Soft 2D building collisions + road bias for free-drive.
 * MapLibre Protomaps footprints / road centerlines — no rigid-body solver.
 */

import { RACE_CAR_RADIUS_M } from './drivingCamera'

export type LngLatTuple = [number, number]

export interface BuildingFootprint {
  /** Exterior ring as [lon, lat] pairs (closed or open). */
  ring: LngLatTuple[]
}

/** Road centerline segment in lon/lat. */
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
  /** Wall normal in local metres (for slide); unit length when hit. */
  wallNx?: number
  wallNy?: number
}

const DEG2RAD = Math.PI / 180

/** Local ENU-ish metres relative to an origin lat/lon. */
function toLocalM(lon: number, lat: number, originLon: number, originLat: number): [number, number] {
  const cosLat = Math.max(0.2, Math.cos(originLat * DEG2RAD))
  const x = (lon - originLon) * 111_320 * cosLat
  const y = (lat - originLat) * 111_320
  return [x, y]
}

function fromLocalM(x: number, y: number, originLon: number, originLat: number): LngLatTuple {
  const cosLat = Math.max(0.2, Math.cos(originLat * DEG2RAD))
  return [originLon + x / (111_320 * cosLat), originLat + y / 111_320]
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

/** Closest point on segment AB to P. */
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
  const dx = px - x, dy = py - y
  const len = Math.sqrt(len2) || 1
  return { x, y, dist: Math.hypot(dx, dy), tx: abx / len, ty: aby / len }
}

/**
 * Resolve car against building footprints.
 * Push-out + wall-slide: keep velocity component along the wall, kill into-wall speed.
 */
export function resolveBuildingCollision(
  pose: CollisionPose,
  footprints: BuildingFootprint[],
  carRadiusM = RACE_CAR_RADIUS_M,
): CollisionResult {
  if (!footprints.length || !Number.isFinite(pose.lon) || !Number.isFinite(pose.lat)) {
    return { ...pose, hit: false }
  }

  let x = 0
  let y = 0
  let speed = pose.speedMps
  let hit = false
  let wallNx = 0
  let wallNy = 0
  const originLon = pose.lon
  const originLat = pose.lat

  // Velocity in local metres (heading 0 = north = +y)
  const hrad = (pose.heading * Math.PI) / 180
  let vx = Math.sin(hrad) * speed
  let vy = Math.cos(hrad) * speed

  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const fp of footprints) {
      if (!fp.ring || fp.ring.length < 3) continue
      const local: [number, number][] = fp.ring.map(([lon, lat]) =>
        toLocalM(lon, lat, originLon, originLat),
      )
      if (local.length > 1) {
        const a = local[0], b = local[local.length - 1]
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3) local.pop()
      }
      if (local.length < 3) continue

      const inside = pointInRing(x, y, local)
      let best = { x, y, dist: Infinity, tx: 1, ty: 0 }
      for (let i = 0; i < local.length; i++) {
        const j = (i + 1) % local.length
        const c = closestOnSeg(x, y, local[i][0], local[i][1], local[j][0], local[j][1])
        if (c.dist < best.dist) best = c
      }

      if (inside || best.dist < carRadiusM) {
        hit = true
        moved = true
        let nx = x - best.x
        let ny = y - best.y
        let nlen = Math.hypot(nx, ny)
        if (nlen < 1e-6) {
          nx = 1; ny = 0; nlen = 1
        }
        nx /= nlen
        ny /= nlen
        if (inside) {
          nx = -nx
          ny = -ny
        }
        wallNx = nx
        wallNy = ny

        const push = inside ? carRadiusM + 0.4 : (carRadiusM - best.dist + 0.2)
        x = best.x + nx * Math.max(push, carRadiusM)
        y = best.y + ny * Math.max(push, carRadiusM)
        if (pointInRing(x, y, local)) {
          x += nx * 1.2
          y += ny * 1.2
        }

        // Slide: remove into-wall velocity, keep tangent with friction.
        const into = vx * nx + vy * ny
        if (into < 0) {
          vx -= into * nx
          vy -= into * ny
        }
        // Wall friction — bleed slide speed
        vx *= 0.72
        vy *= 0.72
      }
    }
    if (!moved) break
  }

  if (hit) {
    speed = Math.hypot(vx, vy)
    // Cap residual after impact
    speed = Math.min(speed, Math.max(0, pose.speedMps * 0.45))
    // Align heading with remaining velocity when sliding
    if (speed > 0.8) {
      const slideH = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360
      // Blend heading toward slide so wall-ride feels natural
      const dh = ((slideH - pose.heading + 540) % 360) - 180
      return {
        lon: fromLocalM(x, y, originLon, originLat)[0],
        lat: fromLocalM(x, y, originLon, originLat)[1],
        heading: ((pose.heading + dh * 0.35) % 360 + 360) % 360,
        speedMps: speed,
        hit: true,
        wallNx,
        wallNy,
      }
    }
  }

  const [lon, lat] = fromLocalM(x, y, originLon, originLat)
  return {
    lon,
    lat,
    heading: pose.heading,
    speedMps: hit ? Math.min(speed, pose.speedMps * 0.4) : pose.speedMps,
    hit,
    wallNx: hit ? wallNx : undefined,
    wallNy: hit ? wallNy : undefined,
  }
}

/**
 * Weak attraction toward the nearest road centerline (free-drive “stay on pavement” feel).
 * Does not hard-snap — gently pulls position and soft-aligns heading.
 */
export function softRoadBias(
  pose: CollisionPose,
  segments: RoadSegment[],
  opts?: { pullM?: number; headingBlend?: number; maxDistM?: number },
): CollisionPose {
  if (!segments.length) return pose
  const pullM = opts?.pullM ?? 0.35
  const headingBlend = opts?.headingBlend ?? 0.08
  const maxDistM = opts?.maxDistM ?? 28

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

  if (!Number.isFinite(bestDist) || bestDist > maxDistM || bestDist < 0.4) {
    return pose
  }

  // Pull strength falls off with distance
  const t = Math.min(1, pullM / Math.max(bestDist, 0.5))
  const nx = bestX * t
  const ny = bestY * t
  const [lon, lat] = fromLocalM(nx, ny, originLon, originLat)

  // Road heading (tangent); pick direction closer to current heading
  let roadH = ((Math.atan2(bestTx, bestTy) * 180) / Math.PI + 360) % 360
  const alt = (roadH + 180) % 360
  const d1 = Math.abs(((roadH - pose.heading + 540) % 360) - 180)
  const d2 = Math.abs(((alt - pose.heading + 540) % 360) - 180)
  if (d2 < d1) roadH = alt

  const dh = ((roadH - pose.heading + 540) % 360) - 180
  const heading = ((pose.heading + dh * headingBlend) % 360 + 360) % 360

  return { lon, lat, heading, speedMps: pose.speedMps }
}

/**
 * Extract exterior rings from GeoJSON-like MapLibre features.
 */
export function footprintsFromFeatures(
  features: Array<{ geometry?: { type?: string; coordinates?: unknown } | null }>,
  max = 48,
): BuildingFootprint[] {
  const out: BuildingFootprint[] = []
  for (const f of features) {
    if (out.length >= max) break
    const g = f.geometry
    if (!g?.coordinates) continue
    if (g.type === 'Polygon') {
      const coords = g.coordinates as number[][][]
      const ring = coords[0]
      if (ring && ring.length >= 3) {
        out.push({ ring: ring.map((c) => [c[0], c[1]] as LngLatTuple) })
      }
    } else if (g.type === 'MultiPolygon') {
      const polys = g.coordinates as number[][][][]
      for (const poly of polys) {
        if (out.length >= max) break
        const ring = poly[0]
        if (ring && ring.length >= 3) {
          out.push({ ring: ring.map((c) => [c[0], c[1]] as LngLatTuple) })
        }
      }
    }
  }
  return out
}

/** Flatten LineString / MultiLineString features into short segments. */
export function roadSegmentsFromFeatures(
  features: Array<{ geometry?: { type?: string; coordinates?: unknown } | null }>,
  maxSegs = 80,
): RoadSegment[] {
  const out: RoadSegment[] = []
  const pushLine = (coords: number[][]) => {
    for (let i = 1; i < coords.length && out.length < maxSegs; i++) {
      const a = coords[i - 1]
      const b = coords[i]
      if (!a || !b) continue
      out.push({ a: [a[0], a[1]], b: [b[0], b[1]] })
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

/** Bbox around lon/lat in degrees (~radiusM). */
export function bboxAround(lon: number, lat: number, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111_320
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos(lat * DEG2RAD)))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}
