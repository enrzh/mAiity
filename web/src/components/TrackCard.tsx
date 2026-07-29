import { Bike, Car, Clock, Footprints, Gauge, Navigation2, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useT } from '../lib/useT'
import { useApp } from '../state'

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)
const fmtDur = (s: number) => {
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/**
 * Premium track / route summary for the shrunk detail sheet.
 * Shows ETA, distance, mode — liquid glass stats row.
 */
export function TrackCard({ className }: { className?: string }) {
  const app = useApp()
  const t = useT()
  const route = app.route
  if (!route || route.status !== 'ready' || !route.result) return null
  const r = route.result
  const ModeIcon = route.mode === 'bike' ? Bike : route.mode === 'foot' ? Footprints : Car
  const modeLabel =
    route.mode === 'bike' ? t('mode-bike') : route.mode === 'foot' ? t('mode-foot') : t('mode-car')
  const avgKmh = r.durationS > 0 ? (r.distanceM / 1000) / (r.durationS / 3600) : 0

  return (
    <section
      className={cn(
        'maps-glass-pill space-y-3 rounded-2xl p-3.5',
        className,
      )}
      aria-label={t('track-info')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Route className="size-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold tracking-tight">{t('track-info')}</p>
            <p className="text-[11px] text-muted-foreground">{route.to.name}</p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1 rounded-full px-2.5 py-0.5 font-medium">
          <ModeIcon className="size-3.5" />
          {modeLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="maps-track-stat rounded-xl bg-background/50 px-2.5 py-2">
          <span className="maps-track-stat__label flex items-center gap-1">
            <Clock className="size-3" /> {t('track-eta')}
          </span>
          <span className="maps-track-stat__value text-primary">{fmtDur(r.durationS)}</span>
        </div>
        <div className="maps-track-stat rounded-xl bg-background/50 px-2.5 py-2">
          <span className="maps-track-stat__label flex items-center gap-1">
            <Route className="size-3" /> {t('track-distance')}
          </span>
          <span className="maps-track-stat__value">{fmtDist(r.distanceM)}</span>
        </div>
        <div className="maps-track-stat rounded-xl bg-background/50 px-2.5 py-2">
          <span className="maps-track-stat__label flex items-center gap-1">
            <Gauge className="size-3" /> {t('track-avg')}
          </span>
          <span className="maps-track-stat__value">
            {avgKmh > 0 ? `${Math.round(avgKmh)}` : '—'}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">km/h</span>
          </span>
        </div>
      </div>

      <Separator className="opacity-50" />

      <div className="flex gap-2">
        {!app.navigating && (
          <Button className="h-11 flex-1 gap-2 rounded-full font-semibold" onClick={app.startNavigation}>
            <Navigation2 className="size-4" />
            {t('nav-start')}
          </Button>
        )}
        {route.mode === 'car' && app.driving.status === 'idle' && (
          <Button
            variant="secondary"
            className="h-11 flex-1 gap-2 rounded-full font-semibold"
            onClick={app.armDrivingMode}
          >
            <Car className="size-4" />
            {t('race-start')}
          </Button>
        )}
      </div>
    </section>
  )
}
