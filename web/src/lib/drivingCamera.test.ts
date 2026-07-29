import { describe, expect, test } from 'bun:test'
import {
  carPositionAt,
  offsetAlongBearing,
  offsetLateral,
  raceCameraAt,
  RACE_LOOKAHEAD_M,
  RACE_PITCH,
  RACE_ZOOM,
} from './drivingCamera'

describe('drivingCamera', () => {
  test('raceCameraAt is first-person: looks ahead along bearing', () => {
    const origin: [number, number] = [6.8, 51.2]
    const cam = raceCameraAt(origin, 0) // north
    // Center should be north of the car (look-ahead).
    expect(cam.center[0]).toBeCloseTo(origin[0], 5)
    expect(cam.center[1]).toBeGreaterThan(origin[1])
    expect(cam.bearing).toBe(0)
    expect(cam.pitch).toBe(RACE_PITCH)
    expect(cam.zoom).toBe(RACE_ZOOM)
    expect(cam.pitch).toBeGreaterThanOrEqual(75) // driver-eye, not bird's-eye
  })

  test('raceCameraAt respects lookAheadM override', () => {
    const origin: [number, number] = [6.8, 51.2]
    const near = raceCameraAt(origin, 90, { lookAheadM: 5 })
    const far = raceCameraAt(origin, 90, { lookAheadM: RACE_LOOKAHEAD_M })
    // Bearing 90 = east → lon increases with look-ahead.
    expect(far.center[0]).toBeGreaterThan(near.center[0])
  })

  test('offsetAlongBearing moves north for bearing 0', () => {
    const origin: [number, number] = [6.8, 51.2]
    const ahead = offsetAlongBearing(origin, 0, 100)
    expect(ahead[0]).toBeCloseTo(6.8, 5)
    expect(ahead[1]).toBeGreaterThan(origin[1])
  })

  test('lateral offset moves east when traveling north', () => {
    const origin: [number, number] = [6.8, 51.2]
    const right = offsetLateral(origin, 0, 50)
    expect(right[0]).toBeGreaterThan(origin[0])
    expect(right[1]).toBeCloseTo(origin[1], 4)
  })

  test('carPositionAt applies lane scale from lateral input', () => {
    const origin: [number, number] = [6.8, 51.2]
    expect(carPositionAt(origin, 0, 0)).toEqual(origin)
    const right = carPositionAt(origin, 0, 1)
    expect(right[0]).toBeGreaterThan(origin[0])
  })
})
