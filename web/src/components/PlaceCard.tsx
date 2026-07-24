import { useEffect, useState } from 'react'
import { Navigation, Share2, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useApp } from '../state'

/// Bottom card for the selected place: name, address, save/unsave star.
export function PlaceCard() {
  const app = useApp()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const place = app.selected

  // Reset transient state whenever another place is selected.
  useEffect(() => { setError(null); setSaving(false) }, [place])

  if (!place) return null
  const saved = !!app.bookmarkFor(place)

  const toggleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await app.saveBookmark(place)
    } catch {
      setError('Speichern fehlgeschlagen — bitte erneut versuchen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="absolute bottom-6 left-1/2 z-20 w-[min(440px,calc(100vw-24px))] -translate-x-1/2 py-0 shadow-2xl">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold">{place.name}</div>
          <div className="truncate text-sm text-muted-foreground">{place.label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">
            {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
          </div>
          {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            onClick={() => app.startRoute(place)}
            aria-label="Route hierhin"
            title="Route hierhin"
          >
            <Navigation className="size-5 text-primary" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={async () => {
              const url = `${location.origin}/maps/?p=${place.lat.toFixed(5)},${place.lon.toFixed(5)},${encodeURIComponent(place.name)}`
              try {
                if (navigator.share) await navigator.share({ title: place.name, url })
                else { await navigator.clipboard.writeText(url); toast.success('Link kopiert.') }
              } catch { /* user cancelled the share sheet */ }
            }}
            aria-label="Ort teilen"
            title="Ort teilen"
          >
            <Share2 className="size-5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={toggleSave}
            disabled={saving}
            aria-pressed={saved}
            aria-label={saved ? 'Ort gespeichert — entfernen' : 'Ort speichern'}
            title={saved ? 'Gespeichert — tippen zum Entfernen' : 'Ort speichern'}
          >
            <Star className={cn('size-5', saved ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => app.select(null)} aria-label="Schließen">
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
