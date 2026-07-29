import { progressForElapsed } from './driving'

export type DrivingStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished'
/** Route time-trial vs open-world free drive. */
export type DriveKind = 'route' | 'free'

export interface DrivingSession {
  status: DrivingStatus
  mode: 'game'
  kind: DriveKind
  startedAt: number | null
  lastInputAt: number | null
  elapsedMs: number
  durationMs: number
  progress: number
  distanceM: number
  speedMps: number
  lateral: number
  /** World pose (always set while not idle). */
  lon: number
  lat: number
  heading: number
  /** Last building collision time (ms epoch); HUD flash while fresh. */
  lastHitAt?: number | null
}

export interface DrivingRun {
  id: string
  createdAt: number
  durationMs: number
  distanceM: number
  averageSpeedKmh: number
  mode: 'game'
  kind?: DriveKind
}

export const DRIVING_RUNS_KEY = 'maps.driving-runs.v1'

export const idleSession = (): DrivingSession => ({
  status: 'idle',
  mode: 'game',
  kind: 'route',
  startedAt: null,
  lastInputAt: null,
  elapsedMs: 0,
  durationMs: 0,
  progress: 0,
  distanceM: 0,
  speedMps: 0,
  lateral: 0,
  lon: 0,
  lat: 0,
  heading: 0,
  lastHitAt: null,
})

export function createDrivingSession(
  route: { distanceM: number; durationS: number },
  pose?: { lon: number; lat: number; heading?: number },
  now = Date.now(),
): DrivingSession {
  void now
  if (!Number.isFinite(route.distanceM) || route.distanceM <= 0) return idleSession()
  const routeDuration = Math.max(20_000, route.durationS * 1000)
  const durationMs = Math.max(30_000, Math.round(routeDuration * 0.72))
  return {
    status: 'ready',
    mode: 'game',
    kind: 'route',
    startedAt: null,
    lastInputAt: null,
    elapsedMs: 0,
    durationMs,
    progress: 0,
    distanceM: route.distanceM,
    speedMps: 0,
    lateral: 0,
    lon: pose?.lon ?? 0,
    lat: pose?.lat ?? 0,
    heading: pose?.heading ?? 0,
    lastHitAt: null,
  }
}

export function createFreeDrivingSession(
  pose: { lon: number; lat: number; heading?: number },
  now = Date.now(),
): DrivingSession {
  void now
  if (!Number.isFinite(pose.lon) || !Number.isFinite(pose.lat)) return idleSession()
  return {
    status: 'ready',
    mode: 'game',
    kind: 'free',
    startedAt: null,
    lastInputAt: null,
    elapsedMs: 0,
    // Soft “session” timer for free roam (no finish line)
    durationMs: 60 * 60 * 1000,
    progress: 0,
    distanceM: 0,
    speedMps: 0,
    lateral: 0,
    lon: pose.lon,
    lat: pose.lat,
    heading: pose.heading ?? 0,
    lastHitAt: null,
  }
}

export function createDrivingSessionForMode(
  mode: string,
  route: { distanceM: number; durationS: number },
  pose?: { lon: number; lat: number; heading?: number },
  now = Date.now(),
): DrivingSession {
  if (mode !== 'car') return idleSession()
  return createDrivingSession(route, pose, now)
}

export function startDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'ready') return session
  if (session.kind === 'route' && session.distanceM <= 0) return session
  return { ...session, status: 'running', startedAt: now, lastInputAt: now, speedMps: 0, lateral: 0 }
}

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
  }
}

export function resumeDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'paused') return session
  return { ...session, status: 'running', startedAt: now - session.elapsedMs, lastInputAt: now }
}

export function tickDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'running' || session.startedAt == null) return session
  const elapsedMs = Math.max(0, now - session.startedAt)
  const progress = session.kind === 'free' ? 0 : progressForElapsed(elapsedMs, session.durationMs)
  return { ...session, elapsedMs, progress }
}

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
    progress: session.kind === 'free' ? session.progress : 1,
    speedMps: 0,
  }
}

export function resetDriving(session: DrivingSession): DrivingSession {
  if (session.kind === 'free') {
    return {
      ...session,
      status: 'ready',
      startedAt: null,
      lastInputAt: null,
      elapsedMs: 0,
      progress: 0,
      distanceM: 0,
      speedMps: 0,
      lateral: 0,
    }
  }
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
  const distanceM = session.kind === 'free' ? session.distanceM : session.distanceM * (session.kind === 'route' ? Math.min(1, session.progress || 1) : 1)
  // For route races use full route distance on finish; for free use driven metres
  const dist = session.kind === 'free'
    ? session.distanceM
    : (session.progress >= 1 ? session.distanceM : session.distanceM * session.progress)
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    durationMs,
    distanceM: dist,
    averageSpeedKmh: durationMs > 0 ? (dist / 1000) / (durationMs / 3_600_000) : 0,
    mode: session.mode,
    kind: session.kind,
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
