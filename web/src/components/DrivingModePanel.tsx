import { Car, Flag, Pause, Play, RotateCcw, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pointAtProgress } from '../lib/driving'
import { useApp } from '../state'
import { useEffect, useMemo, useRef } from 'react'

const fmtTime = (ms: number) => {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

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
    let previous = performance.now()
    const loop = (now: number) => {
      // The physics function receives its own capped delta; the render loop
      // stays local to the game and never advances the map marker directly.
      app.driveDrivingMode(keys.current, Date.now())
      previous = now
      void previous
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [app.driveDrivingMode, session.status])

  const currentPoint = useMemo(() => route ? pointAtProgress(route.geometry, session.progress) : null, [route, session.progress])
  if (!route || session.status === 'idle') return null
  const speed = Math.round(session.speedMps * 3.6)

  const hold = (type: 'throttle' | 'brake' | 'left' | 'right', value: boolean) => {
    if (type === 'throttle') keys.current.throttle = value
    if (type === 'brake') keys.current.brake = value
    if (type === 'left') keys.current.steer = value ? -1 : keys.current.steer === -1 ? 0 : keys.current.steer
    if (type === 'right') keys.current.steer = value ? 1 : keys.current.steer === 1 ? 0 : keys.current.steer
  }

  return (
    <section className="maps-driving-game" aria-label="Driving game">
      <div className="maps-driving-horizon" aria-hidden="true">
        <div className="maps-driving-sky" />
        <div className="maps-driving-road"><i /><i /><i /></div>
        <div className="maps-driving-car-view"><Car /></div>
      </div>
      <div className="maps-driving-hud">
        <div className="maps-driving-stat"><Gauge className="size-4" /> {speed} km/h</div>
        <div className="maps-driving-stat">{fmtTime(session.elapsedMs)} · {Math.round(session.progress * 100)}%</div>
        <div className="maps-driving-progress"><span style={{ width: `${session.progress * 100}%` }} /></div>
      </div>
      <div className="maps-driving-actions">
        {session.status === 'ready' && <Button onClick={app.startDrivingMode}><Play className="mr-2 size-4" />Start drive</Button>}
        {session.status === 'running' && <Button variant="secondary" onClick={app.pauseDrivingMode}><Pause className="mr-2 size-4" />Pause</Button>}
        {session.status === 'paused' && <Button onClick={app.resumeDrivingMode}><Play className="mr-2 size-4" />Resume</Button>}
        {(session.status === 'running' || session.status === 'paused') && <Button variant="outline" onClick={app.finishDrivingMode}><Flag className="mr-2 size-4" />Finish</Button>}
      </div>
      {session.status === 'running' && <div className="maps-driving-touch" aria-label="Driving controls">
        <Button size="lg" variant="secondary" onPointerDown={() => hold('left', true)} onPointerUp={() => hold('left', false)} onPointerLeave={() => hold('left', false)}>←</Button>
        <Button size="lg" variant="secondary" onPointerDown={() => hold('brake', true)} onPointerUp={() => hold('brake', false)} onPointerLeave={() => hold('brake', false)}>Brake</Button>
        <Button size="lg" onPointerDown={() => hold('throttle', true)} onPointerUp={() => hold('throttle', false)} onPointerLeave={() => hold('throttle', false)}>Go</Button>
        <Button size="lg" variant="secondary" onPointerDown={() => hold('right', true)} onPointerUp={() => hold('right', false)} onPointerLeave={() => hold('right', false)}>→</Button>
      </div>}
      {session.status === 'finished' && <div className="maps-driving-finished"><RotateCcw className="size-4" /> Run complete · {fmtTime(session.elapsedMs)}</div>}
      {currentPoint && <span className="sr-only">Position {currentPoint[1].toFixed(4)}, {currentPoint[0].toFixed(4)}</span>}
    </section>
  )
}
