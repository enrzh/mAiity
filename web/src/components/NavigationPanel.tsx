import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Navigation2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { followActiveNavigation } from '../maps/rendererController'
import {
  OFF_ROUTE_M, bearing, currentStep, metresToNextManeuver, snapToRoute, type LngLat,
} from '../lib/navigation'
import { useT } from '../lib/useT'
import { useApp } from '../state'

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`)
const fmtEta = (s: number) => {
  const min = Math.max(1, Math.round(s / 60))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}

/// Turn-by-turn: follows the user, advances steps by proximity, and reroutes
/// when they leave the line. Provider-neutral via followActiveNavigation
/// (MapLibre + Apple MapKit JS).
export function NavigationPanel() {
  const app = useApp()
  const t = useT()
  const route = app.route
  const geometry = (route?.result?.geometry ?? []) as LngLat[]
  const steps = route?.result?.steps ?? []

  const [stepIdx, setStepIdx] = useState(0)
  const [toManeuver, setToManeuver] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(route?.result?.distanceM ?? 0)
  const [offRoute, setOffRoute] = useState(false)
  const lastIdx = useRef(0)
  const rerouting = useRef(false)

  useEffect(() => {
    if (!app.navigating || geometry.length < 2 || !navigator.geolocation) return
    lastIdx.current = 0
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos: LngLat = [p.coords.longitude, p.coords.latitude]
        const snap = snapToRoute(pos, geometry, lastIdx.current)
        lastIdx.current = snap.index

        // Heading: GPS course when moving, else the route's own direction.
        const head = Number.isFinite(p.coords.heading as number) && (p.coords.speed ?? 0) > 1
          ? (p.coords.heading as number)
          : bearing(geometry[snap.index], geometry[Math.min(snap.index + 1, geometry.length - 1)])
        followActiveNavigation({ lat: pos[1], lon: pos[0], heading: head })

        const si = currentStep(steps, snap.index)
        setStepIdx(si)
        setRemaining(snap.remainingM)
        const next = steps[si + 1]
        setToManeuver(next ? metresToNextManeuver(geometry, snap.index, pos, next.beginIdx) : null)

        // Left the line? Ask for a fresh route from where we actually are.
        const isOff = snap.offRouteM > OFF_ROUTE_M
        setOffRoute(isOff)
        if (isOff && !rerouting.current && route) {
          rerouting.current = true
          app.setRouteStart({ name: t('current-position'), label: '', lat: pos[1], lon: pos[0] })
          setTimeout(() => { rerouting.current = false }, 12_000) // don't thrash
        }
      },
      () => { /* lost the fix — keep the last known state */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.navigating, route?.result])

  if (!app.navigating || !route?.result) return null
  const step = steps[stepIdx]
  const next = steps[stepIdx + 1]
  const eta = new Date(Date.now() + (route.result.durationS * (remaining / Math.max(1, route.result.distanceM))) * 1000)

  return (
    <Card className="gap-0 border-primary/30 bg-primary/5 py-0 shadow-none">
      <CardContent className="space-y-3 p-3.5">
        {/* Current maneuver — the only thing that matters while moving. */}
        <div className="flex items-start gap-3">
          <Navigation2 className="mt-0.5 size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            {toManeuver !== null && (
              <div className="text-2xl font-bold leading-none tabular-nums">{fmtDist(toManeuver)}</div>
            )}
            <p className="mt-1 text-[15px] font-medium leading-snug">
              {next?.instruction ?? step?.instruction ?? t('nav-continue')}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={app.stopNavigation} aria-label={t('nav-stop')}>
            <X className="size-4" />
          </Button>
        </div>

        {offRoute && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[13px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" /> {t('off-route')}
          </p>
        )}

        <div className="flex items-baseline justify-between border-t border-border/60 pt-2.5 text-sm">
          <span className="font-semibold tabular-nums">{fmtEta(route.result.durationS * (remaining / Math.max(1, route.result.distanceM)))}</span>
          <span className="text-muted-foreground tabular-nums">{fmtDist(remaining)}</span>
          <span className="text-muted-foreground tabular-nums">
            {eta.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {next && steps[stepIdx + 2] && (
          <p className="truncate text-xs text-muted-foreground">{t('nav-then')} {steps[stepIdx + 2].instruction}</p>
        )}
      </CardContent>
    </Card>
  )
}
