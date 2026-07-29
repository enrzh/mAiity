import { describe, expect, test } from 'bun:test'
import {
  footprintsFromFeatures,
  resolveBuildingCollision,
} from './drivingCollision'

describe('drivingCollision', () => {
  // Unit square building roughly 20×20 m around (6.8, 51.2)
  const square: [number, number][] = [
    [6.7998, 51.1998],
    [6.8002, 51.1998],
    [6.8002, 51.2002],
    [6.7998, 51.2002],
    [6.7998, 51.1998],
  ]

  test('point outside is unchanged', () => {
    const pose = { lon: 6.81, lat: 51.21, heading: 0, speedMps: 20 }
    const next = resolveBuildingCollision(pose, [{ ring: square }])
    expect(next.hit).toBe(false)
    expect(next.lon).toBeCloseTo(pose.lon, 5)
    expect(next.speedMps).toBe(20)
  })

  test('point inside is pushed out and slowed', () => {
    const pose = { lon: 6.8, lat: 51.2, heading: 90, speedMps: 30 }
    const next = resolveBuildingCollision(pose, [{ ring: square }], 1.5)
    expect(next.hit).toBe(true)
    expect(next.speedMps).toBeLessThan(30)
    // Should not remain at the centre
    const moved = Math.hypot(next.lon - pose.lon, next.lat - pose.lat)
    expect(moved).toBeGreaterThan(1e-6)
  })

  test('footprintsFromFeatures reads polygons', () => {
    const fps = footprintsFromFeatures([
      {
        geometry: {
          type: 'Polygon',
          coordinates: [square],
        },
      },
    ])
    expect(fps).toHaveLength(1)
    expect(fps[0].ring.length).toBeGreaterThanOrEqual(4)
  })
})
