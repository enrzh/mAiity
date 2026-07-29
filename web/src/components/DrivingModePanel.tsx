import { Car, Flag, Pause, Play, RotateCcw, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pointAtProgress } from '../lib/driving'
import { useT } from '../lib/useT'
import { useApp } from '../state'
import { useEffect, useMemo, useRef } from 'react'

const fmtTime = (ms: number) => {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

/** Compact race HUD over the live map (not a full-screen fake road). */
export function DrivingModePanel() {
  const app = useApp()
  const t = useT()
  const route = app.route?.result
  const session = app.driving
  const keys = useRef({ throttle: false, brake: false, steer: 0 })
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (session.status !== 'running') {
      keys.current = { throttle: false, brake: false, steer: 0 }
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

  const currentPoint = useMemo(
    () => (route ? pointAtProgress(route.geometry, session.progress) : null),
    [route, session.progress],
  )
  if (!route || session.status === 'idle') return null
  const speed = Math.round(session.speedMps * 3.6)
  const recent = app.drivingRuns.slice(0, 5)

  const hold = (type: 'throttle' | 'brake' | 'left' | 'right', value: boolean) => {
    if (type === 'throttle') keys.current.throttle = value
    if (type === 'brake') keys.current.brake = value
    if (type === 'left') keys.current.steer = value ? -1 : keys.current.steer === -1 ? 0 : keys.current.steer
    if (type === 'right') keys.current.steer = value ? 1 : keys.current.steer === 1 ? 0 : keys.current.steer
  }

  return (
    <section className="maps-race-hud" aria-label={t('race-mode')}>
      <div className="maps-race-hud__top">
        <div className="maps-race-hud__stat">
          <Car className="size-4 shrink-0" aria-hidden />
          <span>{t('race-mode')}</span>
        </div>
        <div className="maps-race-hud__stat">
          <Gauge className="size-4 shrink-0" aria-hidden />
          <span>{speed} km/h</span>
        </div>
        <div className="maps-race-hud__stat">
          <span>{fmtTime(session.elapsedMs)}</span>
          <span className="opacity-70">· {Math.round(session.progress * 100)}%</span>
        </div>
        <div className="maps-race-hud__progress" aria-hidden>
          <span style={{ width: `${session.progress * 100}%` }} />
        </div>
      </div>

      <div className="maps-race-hud__actions">
        {session.status === 'ready' && (
          <Button size="lg" className="min-h-12 flex-1" onClick={app.startDrivingMode}>
            <Play className="mr-2 size-4" />
            {t('race-start')}
          </Button>
        )}
        {session.status === 'running' && (
          <Button size="lg" variant="secondary" className="min-h-12 flex-1" onClick={app.pauseDrivingMode}>
            <Pause className="mr-2 size-4" />
            {t('race-pause')}
          </Button>
        )}
        {session.status === 'paused' && (
          <Button size="lg" className="min-h-12 flex-1" onClick={app.resumeDrivingMode}>
            <Play className="mr-2 size-4" />
            {t('race-resume')}
          </Button>
        )}
        {(session.status === 'running' || session.status === 'paused') && (
          <Button size="lg" variant="outline" className="min-h-12" onClick={app.finishDrivingMode}>
            <Flag className="mr-2 size-4" />
            {t('race-finish')}
          </Button>
        )}
        {session.status === 'finished' && (
          <Button size="lg" className="min-h-12 flex-1" onClick={app.resetDrivingMode}>
            <RotateCcw className="mr-2 size-4" />
            {t('race-again')}
          </Button>
        )}
      </div>

      {session.status === 'running' && (
        <div className="maps-race-hud__touch" aria-label={t('race-mode')}>
          <Button
            size="lg"
            variant="secondary"
            className="maps-race-pad"
            aria-label={t('race-mode') + ' ←'}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('left', true) }}
            onPointerUp={() => hold('left', false)}
            onPointerCancel={() => hold('left', false)}
          >
            ←
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="maps-race-pad"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('brake', true) }}
            onPointerUp={() => hold('brake', false)}
            onPointerCancel={() => hold('brake', false)}
          >
            {t('race-brake')}
          </Button>
          <Button
            size="lg"
            className="maps-race-pad maps-race-pad--go"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold('throttle', true) }}
            onPointerUp={() => hold('throttle', false)}
            onPointerCancel={() => hold('throttle', false)}
          >
            {t('race-go')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="maps-race-pad"
            aria-label={t('race-mode') + ' →'}
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
          <Flag className="size-4" />
          {t('race-complete')} · {fmtTime(session.elapsedMs)}
          {session.distanceM > 0 && session.elapsedMs > 0 && (
            <span className="opacity-70">
              · {Math.round((session.distanceM / 1000) / (session.elapsedMs / 3_600_000))} km/h
            </span>
          )}
        </div>
      )}

      {session.status === 'ready' && (
        <p className="maps-race-hud__hint">{t('race-hint')}</p>
      )}

      {(session.status === 'ready' || session.status === 'finished') && (
        <div className="maps-race-hud__history" aria-label={t('race-recent')}>
          <div className="maps-race-hud__history-title">{t('race-recent')}</div>
          {recent.length === 0 ? (
            <p className="maps-race-hud__hint" style={{ margin: 0 }}>{t('race-empty-runs')}</p>
          ) : (
            <ul className="maps-race-hud__history-list">
              {recent.map((run) => (
                <li key={run.id}>
                  <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                  <span className="tabular-nums">{fmtTime(run.durationMs)}</span>
                  <span className="tabular-nums">{fmtDist(run.distanceM)}</span>
                  <span className="tabular-nums opacity-70">{Math.round(run.averageSpeedKmh)} km/h</span>
                </li>
              ))}
            </ul>
          )}
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
