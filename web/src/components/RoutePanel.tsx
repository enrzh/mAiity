import { ArrowUpDown, Bike, Car, Footprints, Loader2, LocateFixed, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { RouteMode } from '../lib/api'
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
  const route = app.route
  if (!route) return null

  return (
    <Card className="absolute bottom-6 left-1/2 z-20 w-[min(460px,calc(100vw-24px))] -translate-x-1/2 gap-0 py-0 shadow-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Start row — editable */}
            <button
              className="flex w-full items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              onClick={app.beginPickStart}
              title="Startpunkt ändern — dann Ort suchen oder Karte antippen"
            >
              <LocateFixed className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {app.pickingStart
                  ? <span className="text-primary">Startpunkt wählen: suchen oder Karte antippen …</span>
                  : route.from?.name ?? 'Mein Standort'}
              </span>
            </button>
            {/* Destination row */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate font-medium">{route.to.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon-sm" onClick={app.clearRoute} aria-label="Route schließen">
              <X className="size-4" />
            </Button>
            {route.from && (
              <Button variant="ghost" size="icon-sm" onClick={app.swapRoute} aria-label="Start und Ziel tauschen" title="Start und Ziel tauschen">
                <ArrowUpDown className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={route.mode} onValueChange={(v) => app.setRouteMode(v as RouteMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="car" className="flex-1" aria-label="Auto"><Car className="size-4" /></TabsTrigger>
            <TabsTrigger value="bike" className="flex-1" aria-label="Fahrrad"><Bike className="size-4" /></TabsTrigger>
            <TabsTrigger value="foot" className="flex-1" aria-label="Zu Fuß"><Footprints className="size-4" /></TabsTrigger>
          </TabsList>
        </Tabs>

        {route.status === 'loading' ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Route wird berechnet …
          </div>
        ) : route.status === 'error' ? (
          <p className="py-2 text-center text-sm text-destructive">{route.errorText}</p>
        ) : route.result ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold">{fmtDur(route.result.durationS)}</span>
              <span className="text-sm text-muted-foreground">{fmtDist(route.result.distanceM)}</span>
            </div>
            <Separator />
            <ol className="max-h-44 space-y-2 overflow-y-auto pr-1 text-sm">
              {route.result.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {s.instruction}
                    {s.distanceM > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">({fmtDist(s.distanceM)})</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
