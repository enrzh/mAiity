import { ArrowUpDown, Bike, Car, Footprints, Loader2, LocateFixed, MapPin, X } from 'lucide-react'
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
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-2xl bg-background/55 px-3 py-2 text-left text-sm backdrop-blur-sm transition-colors hover:bg-accent"
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
            <div className="flex items-center gap-2 rounded-2xl bg-background/55 px-3 py-2 text-sm backdrop-blur-sm">
              <MapPin className="size-3.5 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate font-semibold">{route.to.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="secondary" size="icon" className="size-9 rounded-full" onClick={app.clearRoute} aria-label={t('route-close')}>
              <X className="size-4" />
            </Button>
            {route.from && (
              <Button variant="ghost" size="icon" className="size-9 rounded-full" onClick={app.swapRoute} aria-label={t('route-swap')} title={t('route-swap')}>
                <ArrowUpDown className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={route.mode} onValueChange={(v) => app.setRouteMode(v as RouteMode)}>
          <TabsList className="h-11 w-full rounded-full bg-background/50 p-1">
            <TabsTrigger value="car" className="flex-1 rounded-full" aria-label={t('mode-car')}><Car className="size-4" /></TabsTrigger>
            <TabsTrigger value="bike" className="flex-1 rounded-full" aria-label={t('mode-bike')}><Bike className="size-4" /></TabsTrigger>
            <TabsTrigger value="foot" className="flex-1 rounded-full" aria-label={t('mode-foot')}><Footprints className="size-4" /></TabsTrigger>
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
            <Separator className="opacity-50" />
            <ol className="max-h-[36vh] space-y-2 overflow-y-auto overscroll-contain pr-1 text-sm md:max-h-none">
              {(route.result.steps ?? []).map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
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
