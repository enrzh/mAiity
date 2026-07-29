import { describe, expect, test } from 'bun:test'
import {
  carPositionAt,
  offsetAlongBearing,
  offsetLateral,
  raceCameraAt,
  vehiclePoseFromSession,
  RACE_LOOKAHEAD_M,
  RACE_PITCH,
  RACE_ZOOM,
} from './drivingCamera'
import { createFreeDrivingSession, createDrivingSession, startDriving } from './drivingSession'

describe('drivingCamera', () => {
  test('raceCameraAt looks ahead along bearing', () => {
    const origin: [number, number] = [6.8, 51.2]
    const cam = raceCameraAt(origin, 0) // north
    expect(cam.center[0]).toBeCloseTo(origin[0], 5)
    expect(cam.center[1]).toBeGreaterThan(origin[1])
    expect(cam.bearing).toBe(0)
    expect(cam.pitch).toBe(RACE_PITCH)
    expect(cam.zoom).toBe(RACE_ZOOM)
    expect(cam.pitch).toBeGreaterThanOrEqual(55)
  })

  test('raceCameraAt respects lookAheadM override', () => {
    const origin: [number, number] = [6.8, 51.2]
    const near = raceCameraAt(origin, 90, { lookAheadM: 5 })
    const far = raceCameraAt(origin, 90, { lookAheadM: RACE_LOOKAHEAD_M })
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

  test('vehiclePoseFromSession uses free pose without route', () => {
    const free = startDriving(createFreeDrivingSession({ lon: 6.77, lat: 51.22, heading: 45 }), 1)
    const pose = vehiclePoseFromSession(free, null)
    expect(pose).toEqual({ lon: 6.77, lat: 51.22, heading: 45 })
  })

  test('vehiclePoseFromSession follows route progress', () => {
    const geo: [number, number][] = [[6.8, 51.2], [6.81, 51.21]]
    const session = { ...createDrivingSession({ distanceM: 1000, durationS: 60 }), status: 'running' as const, progress: 0 }
    const pose = vehiclePoseFromSession(session, geo)
    expect(pose).not.toBeNull()
    expect(pose!.lon).toBeCloseTo(6.8, 3)
    expect(pose!.lat).toBeCloseTo(51.2, 3)
  })
})
