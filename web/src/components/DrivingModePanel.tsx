import { Car, Flag, Pause, Play, RotateCcw, Gauge, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pointAtProgress } from '../lib/driving'
import { useT } from '../lib/useT'
import { useApp } from '../state'
import { useEffect, useMemo, useRef, useState } from 'react'

const fmtTime = (ms: number) => {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

/** Compact race / free-drive HUD over the live map (not a full-screen fake road). */
export function DrivingModePanel() {
  const app = useApp()
  const t = useT()
  const route = app.route?.result
  const session = app.driving
  const isFree = session.kind === 'free'
  const keys = useRef({ throttle: false, brake: false, steer: 0 })
  const frame = useRef<number | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [hitFlash, setHitFlash] = useState(false)

  // Brief collision flash for free-drive wall hits.
  useEffect(() => {
    if (session.lastHitAt == null) return
    setHitFlash(true)
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setHitFlash(false), reduced ? 0 : 180)
    return () => window.clearTimeout(id)
  }, [session.lastHitAt])

  // 3-2-1 before the race actually starts.
  useEffect(() => {
    if (countdown == null) return
    if (countdown <= 0) {
      setCountdown(null)
      app.startDrivingMode()
      return
    }
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), reduced ? 200 : 700)
    return () => window.clearTimeout(id)
  }, [countdown, app.startDrivingMode])

  useEffect(() => {
    if (session.status !== 'running') {
      keys.current = { throttle: false, brake: false, steer: 0 }
      if (session.status === 'idle' || session.status === 'ready') setCountdown(null)
      return
    }
    const down = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement | null)?.isContentEditable) return
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') keys.current.throttle = true
      if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown' || event.key === ' ') keys.current.brake = true
      if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') keys.current.steer = -1
      if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') keys.current.steer = 1
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault()
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') keys.current.throttle = false
      if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown' || event.key === ' ') keys.current.brake = false
      if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
        if (keys.current.steer === -1) keys.current.steer = 0
      }
      if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') {
        if (keys.current.steer === 1) keys.current.steer = 0
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    const loop = () => {
      app.driveDrivingMode(keys.current, Date.now())
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [app.driveDrivingMode, session.status])

  const geometry = route?.geometry
  const currentPoint = useMemo(() => {
    if (isFree && Number.isFinite(session.lon) && Number.isFinite(session.lat)) {
      return [session.lon, session.lat] as [number, number]
    }
    return geometry && geometry.length > 0 ? pointAtProgress(geometry, session.progress) : null
  }, [geometry, session.progress, session.lon, session.lat, isFree])

  const minimap = useMemo(() => {
    if (isFree || !geometry || geometry.length < 2) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pt of geometry) {
      if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue
      const [lon, lat] = pt
      minX = Math.min(minX, lon); maxX = Math.max(maxX, lon)
      minY = Math.min(minY, lat); maxY = Math.max(maxY, lat)
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null
    const pad = 0.08
    const w = Math.max(1e-6, maxX - minX)
    const h = Math.max(1e-6, maxY - minY)
    const to = (lon: number, lat: number) => {
      const x = ((lon - minX) / w) * (1 - 2 * pad) + pad
      const y = 1 - (((lat - minY) / h) * (1 - 2 * pad) + pad)
      return [x * 100, y * 100] as const
    }
    const path = geometry
      .filter((pt) => pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
      .map(([lon, lat], i) => {
        const [x, y] = to(lon, lat)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      }).join(' ')
    const car = currentPoint && Number.isFinite(currentPoint[0]) && Number.isFinite(currentPoint[1])
      ? to(currentPoint[0], currentPoint[1])
      : null
    return { path, car }
  }, [geometry, currentPoint, isFree])

  // Free drive needs no route; route race needs geometry.
  if (session.status === 'idle') return null
  if (!isFree && (!route || !geometry || geometry.length < 2)) return null

  const speed = Math.round(session.speedMps * 3.6)
  const recent = app.drivingRuns.slice(0, 5)
  const countingDown = countdown != null
  const modeLabel = isFree ? t('free-drive') : t('race-mode')
  const startLabel = isFree ? t('free-drive-start') : t('race-start')
  const hintLabel = isFree ? t('free-drive-hint') : t('race-hint')
  const drivenM = isFree ? session.distanceM : session.distanceM * session.progress

  const hold = (type: 'throttle' | 'brake' | 'left' | 'right', value: boolean) => {
    if (type === 'throttle') keys.current.throttle = value
    if (type === 'brake') keys.current.brake = value
    if (type === 'left') keys.current.steer = value ? -1 : keys.current.steer === -1 ? 0 : keys.current.steer
    if (type === 'right') keys.current.steer = value ? 1 : keys.current.steer === 1 ? 0 : keys.current.steer
  }

  const active = session.status === 'running' || session.status === 'paused'
  // Compact while driving: map stays the hero; history/minimap only at rest.
  return (
    <section
      className={`maps-race-hud${active || countingDown ? ' maps-race-hud--compact' : ''}${hitFlash ? ' maps-race-hud--hit' : ''}`}
      aria-label={modeLabel}
    >
      <div className="maps-race-hud__top">
        <div className="maps-race-hud__stat">
          <Car className="size-3.5 shrink-0" aria-hidden />
          <span>{modeLabel}</span>
        </div>
        <div className="maps-race-hud__stat">
          <Gauge className="size-3.5 shrink-0" aria-hidden />
          <span>{speed}</span>
        </div>
        <div className="maps-race-hud__stat">
          <span>{fmtTime(session.elapsedMs)}</span>
          {isFree ? (
            <span className="opacity-70">{fmtDist(drivenM)}</span>
          ) : (
            <span className="opacity-70">{Math.round(session.progress * 100)}%</span>
          )}
        </div>
        {(session.status === 'ready' || session.status === 'finished') && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="maps-race-hud__dismiss ml-auto size-7 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={app.exitDrivingMode}
            aria-label={t('close')}
          >
            <X className="size-3.5" />
          </Button>
        )}
        {!isFree && (
          <div className="maps-race-hud__progress" aria-hidden>
            <span style={{ width: `${session.progress * 100}%` }} />
          </div>
        )}
      </div>

      {countingDown && (
        <div className="maps-race-hud__countdown" aria-live="assertive">
          <span>{countdown === 0 ? 'GO' : countdown}</span>
        </div>
      )}

      {/* Minimap only when not fighting touch pads for vertical space. */}
      {minimap && (session.status === 'ready' || session.status === 'paused') && !countingDown && (
        <svg className="maps-race-minimap" viewBox="0 0 100 40" aria-hidden>
          <rect x="0" y="0" width="100" height="40" rx="6" className="maps-race-minimap__bg" />
          <path d={minimap.path} className="maps-race-minimap__route" />
          {minimap.car && (
            <circle cx={minimap.car[0]} cy={minimap.car[1]} r="2.4" className="maps-race-minimap__car" />
          )}
        </svg>
      )}

      <div className="maps-race-hud__actions">
        {session.status === 'ready' && !countingDown && (
          <Button size="sm" className="min-h-10 flex-1" onClick={() => setCountdown(3)}>
            <Play className="mr-1.5 size-4" />
            {startLabel}
          </Button>
        )}
        {session.status === 'ready' && countingDown && (
          <Button size="sm" variant="outline" className="min-h-10 flex-1" onClick={() => setCountdown(null)}>
            {t('close')}
          </Button>
        )}
        {session.status === 'running' && (
          <Button size="sm" variant="secondary" className="min-h-10 flex-1" onClick={app.pauseDrivingMode}>
            <Pause className="mr-1.5 size-4" />
            {t('race-pause')}
          </Button>
        )}
        {session.status === 'paused' && (
          <Button size="sm" className="min-h-10 flex-1" onClick={app.resumeDrivingMode}>
            <Play className="mr-1.5 size-4" />
            {t('race-resume')}
          </Button>
        )}
        {(session.status === 'running' || session.status === 'paused') && (
          <Button size="sm" variant="outline" className="min-h-10" onClick={app.finishDrivingMode}>
            <Flag className="mr-1.5 size-4" />
            {t('race-finish')}
          </Button>
        )}
        {session.status === 'finished' && (
          <Button size="sm" className="min-h-10 flex-1" onClick={app.resetDrivingMode}>
            <RotateCcw className="mr-1.5 size-4" />
            {t('race-again')}
          </Button>
        )}
      </div>

      {session.status === 'running' && (
        <div className="maps-race-hud__touch" aria-label={modeLabel}>
          <Button
            size="sm"
            variant="secondary"
            className="maps-race-pad"
            aria-label="←"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('left', true) }}
            onPointerUp={() => hold('left', false)}
            onPointerCancel={() => hold('left', false)}
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="maps-race-pad"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('brake', true) }}
            onPointerUp={() => hold('brake', false)}
            onPointerCancel={() => hold('brake', false)}
          >
            {t('race-brake')}
          </Button>
          <Button
            size="sm"
            className="maps-race-pad maps-race-pad--go"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('throttle', true) }}
            onPointerUp={() => hold('throttle', false)}
            onPointerCancel={() => hold('throttle', false)}
          >
            {t('race-go')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="maps-race-pad"
            aria-label="→"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('right', true) }}
            onPointerUp={() => hold('right', false)}
            onPointerCancel={() => hold('right', false)}
          >
            →
          </Button>
        </div>
      )}

      {session.status === 'finished' && (
        <div className="maps-race-hud__finished">
          <Flag className="size-3.5" />
          {t('race-complete')} · {fmtTime(session.elapsedMs)}
          {isFree && drivenM > 0 ? ` · ${fmtDist(drivenM)}` : ''}
        </div>
      )}

      {session.status === 'ready' && !countingDown && (
        <p className="maps-race-hud__hint">{hintLabel}</p>
      )}

      {/* History only at rest — never under the touch pads. */}
      {(session.status === 'ready' || session.status === 'finished') && !countingDown && recent.length > 0 && (
        <div className="maps-race-hud__history" aria-label={t('race-recent')}>
          <div className="maps-race-hud__history-title">{t('race-recent')}</div>
          <ul className="maps-race-hud__history-list">
            {recent.slice(0, 3).map((run) => (
              <li key={run.id}>
                <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                <span className="tabular-nums">{fmtTime(run.durationMs)}</span>
                <span className="tabular-nums">{fmtDist(run.distanceM)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {currentPoint && (
        <span className="sr-only">
          Position {currentPoint[1].toFixed(4)}, {currentPoint[0].toFixed(4)}
        </span>
      )}
    </section>
  )
}
