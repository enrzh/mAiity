import { describe, expect, test } from 'bun:test'
import {
  carPositionAt,
  offsetAlongBearing,
  offsetLateral,
  raceCameraAt,
  RACE_PITCH,
  RACE_ZOOM,
} from './drivingCamera'

describe('drivingCamera', () => {
  test('raceCameraAt returns street-level pitch and zoom', () => {
    const cam = raceCameraAt([6.8, 51.2], 90)
    expect(cam.center).toEqual([6.8, 51.2])
    expect(cam.bearing).toBe(90)
    expect(cam.pitch).toBe(RACE_PITCH)
    expect(cam.zoom).toBe(RACE_ZOOM)
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
