import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NEARBY_CATEGORIES } from '../lib/api'
import { useT } from '../lib/useT'
import { useApp } from '../state'

export const fmtDistance = (m?: number) =>
  m === undefined ? '' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`

/// Results for the active category, nearest first — the list Maps shows
/// beside the pins so you can scan without hunting on the map.
export function PoiResults() {
  const app = useApp()
  const t = useT()
  if (app.pois.length === 0) return null
  const key = NEARBY_CATEGORIES.find((c) => c.id === app.activeCategory)?.labelKey
  const label = key ? t(key) : t('results')

  return (
    <Card className="gap-0 border-border/60 py-0 shadow-none">
      <CardContent className="p-2">
        <div className="flex items-center justify-between px-1.5 pb-1.5 pt-1">
          <h2 className="text-[13px] font-semibold text-muted-foreground">
            {label} · {app.pois.length}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={app.clearPois} aria-label={t('results-close')}>
            <X className="size-3.5" />
          </Button>
        </div>
        <ul className="space-y-0.5">
          {app.pois.map((p, i) => (
            <li key={`${p.lat},${p.lon},${i}`}>
              <button
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent"
                onClick={() => app.selectResult(p)}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-teal-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.label}</span>
                </span>
                {p.distanceM !== undefined && (
                  <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {fmtDistance(p.distanceM)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
