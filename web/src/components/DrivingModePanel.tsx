import { Car, Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { pointAtProgress } from '../lib/driving'
import { useEffect, useMemo, useRef } from 'react'
import { useApp } from '../state'
import { useT } from '../lib/useT'

const fmtTime = (ms: number) => {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
const fmtDist = (m: number) => `${(m / 1000).toFixed(1)} km`

export function DrivingModePanel() {
  const app = useApp()
  const t = useT()
  const frame = useRef<number | null>(null)
  const route = app.route?.result
  const session = app.driving
  const tickDrivingMode = app.tickDrivingMode

  useEffect(() => {
    if (session.status !== 'running') return
    const loop = (now: number) => {
      tickDrivingMode(now)
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
    return () => { if (frame.current != null) cancelAnimationFrame(frame.current) }
  }, [session.status, tickDrivingMode])

  const currentPoint = useMemo(() => route ? pointAtProgress(route.geometry, session.progress) : null, [route, session.progress])
  if (!route || session.status === 'idle') return null

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Car className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Driving mode</p>
            <p className="text-xs text-muted-foreground truncate">{route.distanceM >= 1000 ? fmtDist(route.distanceM) : `${Math.round(route.distanceM)} m`} · {Math.round(session.progress * 100)}%</p>
          </div>
          <span className="font-mono text-lg tabular-nums">{fmtTime(session.elapsedMs)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label="Route progress">
          <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${session.progress * 100}%` }} />
        </div>
        {session.status === 'finished' ? (
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <p className="font-semibold">Run complete</p>
            <p className="text-muted-foreground">{fmtTime(session.elapsedMs)} · {fmtDist(session.distanceM)}</p>
          </div>
        ) : (
          <div className="flex gap-2">
            {session.status === 'ready' && <Button className="flex-1 gap-2" onClick={app.startDrivingMode}><Play className="size-4" /> Start</Button>}
            {session.status === 'running' && <Button className="flex-1 gap-2" variant="secondary" onClick={app.pauseDrivingMode}><Pause className="size-4" /> Pause</Button>}
            {session.status === 'paused' && <Button className="flex-1 gap-2" onClick={app.resumeDrivingMode}><Play className="size-4" /> Resume</Button>}
            {(session.status === 'running' || session.status === 'paused') && <Button variant="outline" size="icon" onClick={app.finishDrivingMode} aria-label="Finish driving"><Flag className="size-4" /></Button>}
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{currentPoint ? `${currentPoint[1].toFixed(4)}, ${currentPoint[0].toFixed(4)}` : t('route')}</span>
          {app.drivingRuns.length > 0 && <span className="inline-flex items-center gap-1"><RotateCcw className="size-3" /> {app.drivingRuns.length} runs</span>}
        </div>
      </CardContent>
    </Card>
  )
}
