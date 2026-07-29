import { describe, expect, test } from 'bun:test'
import { createDrivingSession, finishDriving, pauseDriving, resumeDriving, startDriving } from './drivingSession'

describe('driving session state', () => {
  const route = { distanceM: 10_000, durationS: 600 }

  test('moves through ready, running, paused, and finished states', () => {
    const ready = createDrivingSession(route, 100_000)
    expect(ready.status).toBe('ready')
    expect(startDriving(ready, 1_000).status).toBe('running')
    const paused = pauseDriving({ ...ready, status: 'running', startedAt: 1_000 }, 4_000)
    expect(paused.status).toBe('paused')
    expect(resumeDriving(paused, 5_000).status).toBe('running')
    expect(finishDriving({ ...paused, status: 'paused' }, 6_000).status).toBe('finished')
  })

  test('does not start sessions without a usable route', () => {
    expect(createDrivingSession({ distanceM: 0, durationS: 0 }, 100).status).toBe('idle')
  })
})
