import { progressForElapsed } from './driving'

export type DrivingStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished'

export interface DrivingSession {
  status: DrivingStatus
  mode: 'automatic'
  startedAt: number | null
  elapsedMs: number
  durationMs: number
  progress: number
  distanceM: number
}

export interface DrivingRun {
  id: string
  createdAt: number
  durationMs: number
  distanceM: number
  averageSpeedKmh: number
  mode: 'automatic'
}

export const DRIVING_RUNS_KEY = 'maps.driving-runs.v1'

export function createDrivingSession(route: { distanceM: number; durationS: number }, now = Date.now()): DrivingSession {
  if (!Number.isFinite(route.distanceM) || route.distanceM <= 0) {
    return { status: 'idle', mode: 'automatic', startedAt: null, elapsedMs: 0, durationMs: 0, progress: 0, distanceM: 0 }
  }
  const routeDuration = Math.max(20_000, route.durationS * 1000)
  // A time trial is deliberately faster than normal route ETA, but capped so
  // short city routes remain playable instead of finishing instantly.
  const durationMs = Math.max(30_000, Math.round(routeDuration * 0.72))
  return { status: 'ready', mode: 'automatic', startedAt: null, elapsedMs: 0, durationMs, progress: 0, distanceM: route.distanceM }
}

export function startDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'ready') return session
  return { ...session, status: 'running', startedAt: now }
}

export function pauseDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'running' || session.startedAt == null) return session
  const elapsedMs = Math.max(0, now - session.startedAt)
  return { ...session, status: 'paused', startedAt: null, elapsedMs, progress: progressForElapsed(elapsedMs, session.durationMs) }
}

export function resumeDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'paused') return session
  return { ...session, status: 'running', startedAt: now - session.elapsedMs }
}

export function tickDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (session.status !== 'running' || session.startedAt == null) return session
  const elapsedMs = Math.max(0, now - session.startedAt)
  const progress = progressForElapsed(elapsedMs, session.durationMs)
  return { ...session, elapsedMs, progress }
}

export function finishDriving(session: DrivingSession, now = Date.now()): DrivingSession {
  if (!['running', 'paused'].includes(session.status)) return session
  const current = session.status === 'running' ? tickDriving(session, now) : session
  return { ...current, status: 'finished', startedAt: null, elapsedMs: Math.min(current.elapsedMs, current.durationMs), progress: 1 }
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
