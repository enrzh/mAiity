import { describe, expect, test } from 'bun:test'
import {
  createDrivingSession,
  createDrivingSessionForMode,
  finishDriving,
  pauseDriving,
  resetDriving,
  resumeDriving,
  startDriving,
} from './drivingSession'

describe('driving session state', () => {
  const route = { distanceM: 10_000, durationS: 600 }

  test('moves through ready, running, paused, and finished states', () => {
    const ready = createDrivingSession(route, 100_000)
    expect(ready.status).toBe('ready')
    expect(startDriving(ready, 1_000).status).toBe('running')
    const paused = pauseDriving({ ...ready, status: 'running', startedAt: 1_000, lastInputAt: 1_000, progress: 0.42, elapsedMs: 2_500 }, 4_000)
    expect(paused.status).toBe('paused')
    expect(paused.progress).toBeCloseTo(0.42)
    expect(resumeDriving(paused, 5_000).status).toBe('running')
    expect(finishDriving({ ...paused, status: 'paused' }, 6_000).status).toBe('finished')
  })

  test('does not start sessions without a usable route', () => {
    expect(createDrivingSession({ distanceM: 0, durationS: 0 }, 100).status).toBe('idle')
  })

  test('only car routes arm race mode', () => {
    expect(createDrivingSessionForMode('car', route).status).toBe('ready')
    expect(createDrivingSessionForMode('bike', route).status).toBe('idle')
    expect(createDrivingSessionForMode('foot', route).status).toBe('idle')
  })

  test('pause preserves game physics progress (no teleport)', () => {
    const running = {
      ...createDrivingSession(route, 0),
      status: 'running' as const,
      startedAt: 1_000,
      lastInputAt: 3_000,
      elapsedMs: 2_000,
      progress: 0.37,
      speedMps: 18,
      lateral: 0.4,
    }
    const paused = pauseDriving(running, 3_500)
    expect(paused.status).toBe('paused')
    expect(paused.progress).toBe(0.37)
    expect(paused.lateral).toBe(0.4)
    expect(paused.speedMps).toBe(18)
    expect(paused.elapsedMs).toBe(2_500) // +500 from lastInputAt
  })

  test('finish keeps elapsed from game loop and sets progress to 1', () => {
    const running = {
      ...createDrivingSession(route, 0),
      status: 'running' as const,
      startedAt: 1_000,
      lastInputAt: 5_000,
      elapsedMs: 4_000,
      progress: 0.91,
      speedMps: 22,
    }
    const finished = finishDriving(running, 5_200)
    expect(finished.status).toBe('finished')
    expect(finished.progress).toBe(1)
    expect(finished.speedMps).toBe(0)
    expect(finished.elapsedMs).toBe(4_200)
  })

  test('reset re-arms a finished session for another race', () => {
    const finished = {
      ...createDrivingSession(route, 0),
      status: 'finished' as const,
      elapsedMs: 40_000,
      progress: 1,
      speedMps: 0,
      lateral: 0.5,
    }
    const again = resetDriving(finished)
    expect(again.status).toBe('ready')
    expect(again.progress).toBe(0)
    expect(again.elapsedMs).toBe(0)
    expect(again.lateral).toBe(0)
    expect(again.distanceM).toBe(route.distanceM)
  })
})
