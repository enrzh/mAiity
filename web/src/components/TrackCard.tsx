import { Bike, Car, Clock, Footprints, Gauge, Navigation2, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Surface, Stat } from '@/components/ui/surface'
import { actionClass } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useT } from '../lib/useT'
import { useApp } from '../state'

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)
const fmtDur = (s: number) => {
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/** Route track summary — Surface + Stat components only. */
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
    <Surface
      variant="soft"
      radius="lg"
      padding="md"
      className={cn('space-y-3', className)}
      aria-label={t('track-info')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Route className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">{t('track-info')}</p>
            <p className="truncate text-[12px] text-muted-foreground">{route.to.name}</p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 gap-1 rounded-full px-2 py-0.5 font-medium">
          <ModeIcon className="size-3" />
          {modeLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat
          label={<><Clock className="mr-0.5 inline size-3" />{t('track-eta')}</>}
          value={fmtDur(r.durationS)}
          emphasize
        />
        <Stat
          label={<><Route className="mr-0.5 inline size-3" />{t('track-distance')}</>}
          value={fmtDist(r.distanceM)}
        />
        <Stat
          label={<><Gauge className="mr-0.5 inline size-3" />{t('track-avg')}</>}
          value={avgKmh > 0 ? Math.round(avgKmh) : '—'}
          hint={avgKmh > 0 ? 'km/h' : undefined}
        />
      </div>

      <Separator className="opacity-40" />

      <div className="flex gap-2">
        {!app.navigating && (
          <Button className={actionClass('primary')} onClick={app.startNavigation}>
            <Navigation2 className="size-4" />
            {t('nav-start')}
          </Button>
        )}
        {route.mode === 'car' && app.driving.status === 'idle' && (
          <Button variant="secondary" className={actionClass('secondary')} onClick={app.armDrivingMode}>
            <Car className="size-4" />
            {t('race-start')}
          </Button>
        )}
      </div>
    </Surface>
  )
}
