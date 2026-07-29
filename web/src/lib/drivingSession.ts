import { progressForElapsed } from './driving'

export type DrivingStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished'

export interface DrivingSession {
  status: DrivingStatus
  mode: 'game'
  startedAt: number | null
  lastInputAt: number | null
  elapsedMs: number
  durationMs: number
  progress: number
  distanceM: number
  speedMps: number
  lateral: number
}

export interface DrivingRun {
  id: string
  createdAt: number
  durationMs: number
  distanceM: number
  averageSpeedKmh: number
  mode: 'game'
}

export const DRIVING_RUNS_KEY = 'maps.driving-runs.v1'

const idleSession = (): DrivingSession => ({
  status: 'idle',
  mode: 'game',
  startedAt: null,
  lastInputAt: null,
  elapsedMs: 0,
  durationMs: 0,
  progress: 0,
  distanceM: 0,
  speedMps: 0,
  lateral: 0,
})

export function createDrivingSession(route: { distanceM: number; durationS: number }, now = Date.now()): DrivingSession {
  void now
  if (!Number.isFinite(route.distanceM) || route.distanceM <= 0) return idleSession()
  const routeDuration = Math.max(20_000, route.durationS * 1000)
  // A time trial is deliberately faster than normal route ETA, but capped so
  // short city routes remain playable instead of finishing instantly.
  const durationMs = Math.max(30_000, Math.round(routeDuration * 0.72))
  return {
    status: 'ready',
    mode: 'game',
    startedAt: null,
    lastInputAt: null,
    elapsedMs: 0,
    durationMs,
    progress: 0,
    distanceM: route.distanceM,
    speedMps: 0,
    lateral: 0,
  }
}

/** Only car routes enter race mode; bike/foot stay idle. */
export function createDrivingSessionForMode(
  mode: string,
  route: { distanceM: number; durationS: number },
  now = Date.now(),
): DrivingSession {
  if (mode !== 'car') return idleSession()
  return createDrivingSession(route, now)
}

export function startDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'ready' || session.distanceM <= 0) return session
  return { ...session, status: 'running', startedAt: now, lastInputAt: now, speedMps: 0, lateral: 0 }
}

/**
 * Pause keeps physics progress. Game mode advances progress via throttle, not
 * wall-clock / duration — recomputing progress from elapsed would teleport the car.
 */
export function pauseDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'running') return session
  let elapsedMs = session.elapsedMs
  if (session.lastInputAt != null) {
    elapsedMs = Math.min(session.durationMs, elapsedMs + Math.max(0, now - session.lastInputAt))
  } else if (session.startedAt != null) {
    elapsedMs = Math.max(elapsedMs, now - session.startedAt)
  }
  return {
    ...session,
    status: 'paused',
    startedAt: null,
    lastInputAt: null,
    elapsedMs,
    // progress / lateral / speedMps preserved from game physics
  }
}

export function resumeDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'paused') return session
  return { ...session, status: 'running', startedAt: now - session.elapsedMs, lastInputAt: now }
}

/** Legacy automatic tick (time → progress). Game mode prefers stepDrivingGame. */
export function tickDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'running' || session.startedAt == null) return session
  const elapsedMs = Math.max(0, now - session.startedAt)
  const progress = progressForElapsed(elapsedMs, session.durationMs)
  return { ...session, elapsedMs, progress }
}

/**
 * Finish without rewriting game progress from the clock. Sets progress to 1
 * and freezes the timer at the last known elapsed.
 */
export function finishDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (!['running', 'paused'].includes(session.status)) return session
  let elapsedMs = session.elapsedMs
  if (session.status === 'running' && session.lastInputAt != null) {
    elapsedMs = Math.min(session.durationMs, Math.max(elapsedMs, elapsedMs + Math.max(0, now - session.lastInputAt)))
  } else if (session.status === 'running' && session.startedAt != null) {
    elapsedMs = Math.min(session.durationMs, Math.max(elapsedMs, now - session.startedAt))
  }
  return {
    ...session,
    status: 'finished',
    startedAt: null,
    lastInputAt: null,
    elapsedMs,
    progress: 1,
    speedMps: 0,
  }
}

/** After a finished run, re-arm the same route for another race. */
export function resetDriving(session: DrivingSession): DrivingSession {
  if (session.distanceM <= 0) return idleSession()
  return {
    ...session,
    status: 'ready',
    startedAt: null,
    lastInputAt: null,
    elapsedMs: 0,
    progress: 0,
    speedMps: 0,
    lateral: 0,
  }
}

export function toDrivingRun(session: DrivingSession, now = Date.now()): DrivingRun {
  const durationMs = Math.max(0, session.elapsedMs)
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    durationMs,
    distanceM: session.distanceM,
    averageSpeedKmh: durationMs > 0 ? (session.distanceM / 1000) / (durationMs / 3_600_000) : 0,
    mode: session.mode,
  }
}

export function loadDrivingRuns(storage: Storage = localStorage): DrivingRun[] {
  try {
    const parsed = JSON.parse(storage.getItem(DRIVING_RUNS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.id === 'string').slice(0, 20) : []
  } catch { return [] }
}

export function saveDrivingRun(run: DrivingRun, storage: Storage = localStorage): DrivingRun[] {
  const runs = [run, ...loadDrivingRuns(storage)].slice(0, 20)
  storage.setItem(DRIVING_RUNS_KEY, JSON.stringify(runs))
  return runs
}
