import { describe, expect, test } from 'bun:test'
import { bearingAtProgress, distanceAlongGeometry, pointAtProgress, progressForElapsed } from './driving'

describe('driving playback math', () => {
  const line: [number, number][] = [[0, 0], [0.01, 0], [0.01, 0.01]]

  test('interpolates a point and heading along a route', () => {
    expect(pointAtProgress(line, 0.25)).toEqual([0.005, 0])
    expect(bearingAtProgress(line, 0.25)).toBeCloseTo(90, 0)
  })

  test('calculates route distance and clamps elapsed progress', () => {
    expect(distanceAlongGeometry(line)).toBeGreaterThan(2000)
    expect(progressForElapsed(-1, 10)).toBe(0)
    expect(progressForElapsed(5, 10)).toBe(0.5)
    expect(progressForElapsed(20, 10)).toBe(1)
  })

  test('handles an empty or single-point route', () => {
    expect(pointAtProgress([], 0.5)).toEqual([0, 0])
    expect(distanceAlongGeometry([[1, 2]])).toBe(0)
  })
})
