import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Navigation2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  const remainS = route.result.durationS * (remaining / Math.max(1, route.result.distanceM))

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Navigation2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          {toManeuver !== null && (
            <div className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">
              {fmtDist(toManeuver)}
            </div>
          )}
          <p className="mt-1.5 text-[15px] font-medium leading-snug text-foreground">
            {next?.instruction ?? step?.instruction ?? t('nav-continue')}
          </p>
        </div>
        <Button variant="secondary" size="icon" className="shrink-0 rounded-full" onClick={app.stopNavigation} aria-label={t('nav-stop')}>
          <X className="size-4" />
        </Button>
      </div>

      {offRoute && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" /> {t('off-route')}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-center text-sm">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('track-eta')}</div>
          <div className="mt-0.5 font-semibold tabular-nums">{fmtEta(remainS)}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('track-distance')}</div>
          <div className="mt-0.5 font-semibold tabular-nums">{fmtDist(remaining)}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">ETA</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {eta.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {next && steps[stepIdx + 2] && (
        <p className="truncate text-xs text-muted-foreground">
          {t('nav-then')} {steps[stepIdx + 2].instruction}
        </p>
      )}
    </div>
  )
}
