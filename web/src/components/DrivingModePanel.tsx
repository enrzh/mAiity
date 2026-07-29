import { Car, Flag, Pause, Play, RotateCcw, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pointAtProgress } from '../lib/driving'
import { useApp } from '../state'
import { useEffect, useMemo, useRef } from 'react'

const fmtTime = (ms: number) => {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Compact race HUD over the live map (not a full-screen fake road). */
export function DrivingModePanel() {
  const app = useApp()
  const route = app.route?.result
  const session = app.driving
  const keys = useRef({ throttle: false, brake: false, steer: 0 })
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (session.status !== 'running') return
    const down = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'ArrowUp') keys.current.throttle = true
      if (event.key === 's' || event.key === 'ArrowDown') keys.current.brake = true
      if (event.key === 'a' || event.key === 'ArrowLeft') keys.current.steer = -1
      if (event.key === 'd' || event.key === 'ArrowRight') keys.current.steer = 1
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault()
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'w' || event.key === 'ArrowUp') keys.current.throttle = false
      if (event.key === 's' || event.key === 'ArrowDown') keys.current.brake = false
      if (event.key === 'a' || event.key === 'ArrowLeft' || event.key === 'd' || event.key === 'ArrowRight') keys.current.steer = 0
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
  const de = app.lang === 'de'

  const hold = (type: 'throttle' | 'brake' | 'left' | 'right', value: boolean) => {
    if (type === 'throttle') keys.current.throttle = value
    if (type === 'brake') keys.current.brake = value
    if (type === 'left') keys.current.steer = value ? -1 : keys.current.steer === -1 ? 0 : keys.current.steer
    if (type === 'right') keys.current.steer = value ? 1 : keys.current.steer === 1 ? 0 : keys.current.steer
  }

  return (
    <section className="maps-race-hud" aria-label={de ? 'Rennmodus' : 'Race mode'}>
      <div className="maps-race-hud__top">
        <div className="maps-race-hud__stat">
          <Car className="size-4 shrink-0" aria-hidden />
          <span>{de ? 'Rennen' : 'Race'}</span>
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
            {de ? 'Rennen starten' : 'Start race'}
          </Button>
        )}
        {session.status === 'running' && (
          <Button size="lg" variant="secondary" className="min-h-12 flex-1" onClick={app.pauseDrivingMode}>
            <Pause className="mr-2 size-4" />
            {de ? 'Pause' : 'Pause'}
          </Button>
        )}
        {session.status === 'paused' && (
          <Button size="lg" className="min-h-12 flex-1" onClick={app.resumeDrivingMode}>
            <Play className="mr-2 size-4" />
            {de ? 'Weiter' : 'Resume'}
          </Button>
        )}
        {(session.status === 'running' || session.status === 'paused') && (
          <Button size="lg" variant="outline" className="min-h-12" onClick={app.finishDrivingMode}>
            <Flag className="mr-2 size-4" />
            {de ? 'Ziel' : 'Finish'}
          </Button>
        )}
      </div>

      {session.status === 'running' && (
        <div className="maps-race-hud__touch" aria-label={de ? 'Steuerung' : 'Driving controls'}>
          <Button
            size="lg"
            variant="secondary"
            className="maps-race-pad"
            onPointerDown={() => hold('left', true)}
            onPointerUp={() => hold('left', false)}
            onPointerLeave={() => hold('left', false)}
            onPointerCancel={() => hold('left', false)}
          >
            ←
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="maps-race-pad"
            onPointerDown={() => hold('brake', true)}
            onPointerUp={() => hold('brake', false)}
            onPointerLeave={() => hold('brake', false)}
            onPointerCancel={() => hold('brake', false)}
          >
            {de ? 'Bremse' : 'Brake'}
          </Button>
          <Button
            size="lg"
            className="maps-race-pad maps-race-pad--go"
            onPointerDown={() => hold('throttle', true)}
            onPointerUp={() => hold('throttle', false)}
            onPointerLeave={() => hold('throttle', false)}
            onPointerCancel={() => hold('throttle', false)}
          >
            {de ? 'Gas' : 'Go'}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="maps-race-pad"
            onPointerDown={() => hold('right', true)}
            onPointerUp={() => hold('right', false)}
            onPointerLeave={() => hold('right', false)}
            onPointerCancel={() => hold('right', false)}
          >
            →
          </Button>
        </div>
      )}

      {session.status === 'finished' && (
        <div className="maps-race-hud__finished">
          <RotateCcw className="size-4" />
          {de ? 'Lauf fertig' : 'Run complete'} · {fmtTime(session.elapsedMs)}
        </div>
      )}

      {session.status === 'ready' && (
        <p className="maps-race-hud__hint">
          {de
            ? 'Kamera folgt der Strecke in Straßenansicht. WASD / Pfeile oder Touch-Pads.'
            : 'Camera follows the route at street level. WASD / arrows or touch pads.'}
        </p>
      )}

      {currentPoint && (
        <span className="sr-only">
          Position {currentPoint[1].toFixed(4)}, {currentPoint[0].toFixed(4)}
        </span>
      )}
    </section>
  )
}
