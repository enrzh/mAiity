/**
 * Soft 2D building collisions for free-drive (MapLibre Protomaps footprints).
 * Push car out of polygons and kill speed — no rigid-body solver.
 */

import { RACE_CAR_RADIUS_M } from './drivingCamera'

export type LngLatTuple = [number, number]

export interface BuildingFootprint {
  /** Exterior ring as [lon, lat] pairs (closed or open). */
  ring: LngLatTuple[]
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
): { x: number; y: number; dist: number } {
  const abx = bx - ax, aby = by - ay
  const len2 = abx * abx + aby * aby
  let t = len2 < 1e-12 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const x = ax + abx * t
  const y = ay + aby * t
  const dx = px - x, dy = py - y
  return { x, y, dist: Math.hypot(dx, dy) }
}

/**
 * Resolve car against building footprints. Returns adjusted pose; `hit` if any wall touched.
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
  const originLon = pose.lon
  const originLat = pose.lat

  // Local coords of car start at origin; we push (x,y) then convert back.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const fp of footprints) {
      if (!fp.ring || fp.ring.length < 3) continue
      const local: [number, number][] = fp.ring.map(([lon, lat]) =>
        toLocalM(lon, lat, originLon, originLat),
      )
      // Drop duplicate closing vertex if present
      if (local.length > 1) {
        const a = local[0], b = local[local.length - 1]
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3) local.pop()
      }
      if (local.length < 3) continue

      const inside = pointInRing(x, y, local)
      let best = { x, y, dist: Infinity }
      for (let i = 0; i < local.length; i++) {
        const j = (i + 1) % local.length
        const c = closestOnSeg(x, y, local[i][0], local[i][1], local[j][0], local[j][1])
        if (c.dist < best.dist) best = c
      }

      if (inside || best.dist < carRadiusM) {
        hit = true
        moved = true
        // Outward normal from edge toward exterior: from closest to car if outside,
        // opposite if inside.
        let nx = x - best.x
        let ny = y - best.y
        let nlen = Math.hypot(nx, ny)
        if (nlen < 1e-6) {
          // Degenerate: push east
          nx = 1; ny = 0; nlen = 1
        }
        nx /= nlen
        ny /= nlen
        if (inside) {
          // Closest edge is on the boundary; car is inside so push along -normal
          // from car toward exterior = away from polygon centroid roughly:
          // reverse so we go outside.
          nx = -nx
          ny = -ny
        }
        const push = inside ? carRadiusM + 0.35 : (carRadiusM - best.dist + 0.15)
        x = best.x + nx * Math.max(push, carRadiusM)
        y = best.y + ny * Math.max(push, carRadiusM)
        // If still "inside" due to concave shapes, nudge further
        if (pointInRing(x, y, local)) {
          x += nx * 1.2
          y += ny * 1.2
        }
      }
    }
    if (!moved) break
  }

  if (hit) {
    speed = Math.min(speed, Math.max(0, speed * 0.32))
  }

  const [lon, lat] = fromLocalM(x, y, originLon, originLat)
  return {
    lon,
    lat,
    heading: pose.heading,
    speedMps: speed,
    hit,
  }
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

/** Bbox around lon/lat in degrees (~radiusM). */
export function bboxAround(lon: number, lat: number, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111_320
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos(lat * DEG2RAD)))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}
