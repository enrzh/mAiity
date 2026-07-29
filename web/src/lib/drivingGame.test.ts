import { describe, expect, test } from 'bun:test'
import { stepDrivingGame } from './drivingGame'

describe('first-person driving physics', () => {
  test('accelerates and advances with throttle', () => {
    const next = stepDrivingGame({ progress: 0, speedMps: 0, lateral: 0 }, { throttle: true, brake: false, steer: 0 }, 0.1, 1000)
    expect(next.speedMps).toBeGreaterThan(0)
    expect(next.progress).toBeGreaterThan(0)
  })
  test('steering is bounded and braking cannot reverse', () => {
    const next = stepDrivingGame({ progress: 0, speedMps: 2, lateral: 0.99 }, { throttle: false, brake: true, steer: 10 }, 1, 1000)
    expect(next.speedMps).toBeGreaterThanOrEqual(0)
    expect(next.lateral).toBe(1)
  })
})
