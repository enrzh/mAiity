/**
 * High-frequency driving pose store — updated every animation frame.
 * Map camera + 3D car subscribe here; React HUD samples at a lower rate
 * so setState does not thrash the whole tree at 60fps.
 */

export interface DrivingLivePose {
  status: 'idle' | 'ready' | 'running' | 'paused' | 'finished'
  kind: 'route' | 'free'
  lon: number
  lat: number
  heading: number
  speedMps: number
  lateral: number
  progress: number
  distanceM: number
  elapsedMs: number
  lastHitAt: number | null
}

const IDLE: DrivingLivePose = {
  status: 'idle',
  kind: 'route',
  lon: 0,
  lat: 0,
  heading: 0,
  speedMps: 0,
  lateral: 0,
  progress: 0,
  distanceM: 0,
  elapsedMs: 0,
  lastHitAt: null,
}

let pose: DrivingLivePose = IDLE
const listeners = new Set<() => void>()

export function getDrivingLive(): DrivingLivePose {
  return pose
}

export function setDrivingLive(next: DrivingLivePose): void {
  pose = next
  for (const fn of listeners) {
    try { fn() } catch { /* subscriber error */ }
  }
}

export function patchDrivingLive(partial: Partial<DrivingLivePose>): void {
  setDrivingLive({ ...pose, ...partial })
}

export function resetDrivingLive(): void {
  setDrivingLive(IDLE)
}

/** Subscribe to every live update (map/car rAF). Returns unsubscribe. */
export function subscribeDrivingLive(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
