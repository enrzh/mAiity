import { ArrowUpDown, Bike, Car, Footprints, Loader2, LocateFixed, MapPin, Navigation2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { RouteMode } from '../lib/api'
import { useT } from '../lib/useT'
import { useApp } from '../state'
const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)
const fmtDur = (s: number) => {
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/// Directions: mode tabs, summary, scrollable turn-by-turn list.
export function RoutePanel() {
  const app = useApp()
  const t = useT()
  const route = app.route
  if (!route) return null

  return (
    <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Start row — editable */}
            <button
              className="flex w-full items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              onClick={app.beginPickStart}
              title={t('route-change-start')}
            >
              <LocateFixed className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {app.pickingStart
                  ? <span className="text-primary">{t('route-pick-start')}</span>
                  : route.from?.name ?? t('my-location')}
              </span>
            </button>
            {/* Destination row */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate font-medium">{route.to.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon-sm" onClick={app.clearRoute} aria-label={t('route-close')}>
              <X className="size-4" />
            </Button>
            {route.from && (
              <Button variant="ghost" size="icon-sm" onClick={app.swapRoute} aria-label={t('route-swap')} title={t('route-swap')}>
                <ArrowUpDown className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={route.mode} onValueChange={(v) => app.setRouteMode(v as RouteMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="car" className="flex-1" aria-label={t('mode-car')}><Car className="size-4" /></TabsTrigger>
            <TabsTrigger value="bike" className="flex-1" aria-label={t('mode-bike')}><Bike className="size-4" /></TabsTrigger>
            <TabsTrigger value="foot" className="flex-1" aria-label={t('mode-foot')}><Footprints className="size-4" /></TabsTrigger>
          </TabsList>
        </Tabs>

        {route.status === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>{t('route-loading')}</span>
          </div>
        ) : route.status === 'error' ? (
          <p className="py-2 text-center text-sm text-destructive">{t(route.errorKey ?? 'err-unknown')}</p>
        ) : route.result ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold">{fmtDur(route.result.durationS)}</span>
              <span className="text-sm text-muted-foreground">{fmtDist(route.result.distanceM)}</span>
            </div>
            <Button className="w-full gap-2" onClick={app.startNavigation}>
              <Navigation2 className="size-4" /> {t('nav-start')}
            </Button>
            {/* Race mode: arm / start from the route rail; HUD owns live controls. */}
            {route.mode === 'car' && app.driving.status === 'idle' && (
              <Button className="w-full gap-2" variant="secondary" onClick={app.armDrivingMode}>
                <Car className="size-4" />
                {t('race-start')}
              </Button>
            )}
            {route.mode === 'car' && app.driving.status === 'ready' && (
              <Button className="w-full gap-2" variant="secondary" onClick={() => { app.startDrivingMode() }}>
                <Car className="size-4" />
                {t('race-start')}
              </Button>
            )}
            {route.mode === 'car' && app.driving.status === 'finished' && (
              <Button className="w-full gap-2" variant="secondary" onClick={app.resetDrivingMode}>
                <Car className="size-4" />
                {t('race-again')}
              </Button>
            )}
            {route.mode === 'car' && (app.driving.status === 'running' || app.driving.status === 'paused') && (
              <p className="text-center text-xs text-muted-foreground">{t('race-active-hint')}</p>
            )}
            <Separator />
            <ol className="max-h-[40vh] space-y-2 overflow-y-auto overscroll-contain pr-1 text-sm md:max-h-none">
              {(route.result.steps ?? []).map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    {s.instruction}
                    {(s.distanceM ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">({fmtDist(s.distanceM)})</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
    </div>
  )
}
