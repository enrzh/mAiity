import { useEffect, useState } from 'react'
import {
  Accessibility, Clock, Globe, MapPin, Navigation, Phone, Share2, Star, UtensilsCrossed, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api, type PlaceDetails } from '../lib/api'
import { useT } from '../lib/useT'
import { useApp } from '../state'

/// Place panel: name, address, and whatever OSM knows — opening hours,
/// phone, website, cuisine, accessibility.
export function PlaceCard() {
  const app = useApp()
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<PlaceDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const place = app.selected

  useEffect(() => { setError(null); setSaving(false) }, [place])

  // Fetch details for whichever place is selected (map tap or search hit).
  useEffect(() => {
    if (!place) { setDetails(null); return }
    let cancelled = false
    setLoading(true)
    setDetails(null)
    api.place(place.lat, place.lon, place.name)
      .then((d) => { if (!cancelled) setDetails(d) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [place])

  if (!place) return null
  const saved = !!app.bookmarkFor(place)

  const toggleSave = async () => {
    setSaving(true); setError(null)
    try {
      const wasSaved = !!app.bookmarkFor(place)
      await app.saveBookmark(place)
      // saveBookmark toggles: toast after successful mutation.
      toast.success(wasSaved ? t('saved-remove') : t('save-place'))
    } catch { setError(t('save-failed')) }
    finally { setSaving(false) }
  }

  const address = [details?.street, [details?.postcode, details?.city].filter(Boolean).join(' ')]
    .filter((s) => s && String(s).trim()).join(', ')

  const share = async () => {
    const url = `${location.origin}/maps/?p=${place.lat.toFixed(5)},${place.lon.toFixed(5)},${encodeURIComponent(place.name)}`
    try {
      if (navigator.share) await navigator.share({ title: place.name, url })
      else { await navigator.clipboard.writeText(url); toast.success(t('link-copied')) }
    } catch { /* share sheet dismissed */ }
  }

  return (
    // Flat surface — no nested card chrome inside the rail.
    <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold leading-tight tracking-tight">{place.name}</h2>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
              {address || place.label}
            </p>
            {details?.kind && (
              <Badge variant="secondary" className="mt-1.5 text-[11px] font-medium capitalize">
                {details.kind.replace(/_/g, ' ')}
              </Badge>
            )}
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => app.select(null)} aria-label={t('close')}>
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Primary actions */}
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={() => app.startRoute(place)}>
            <Navigation className="size-4" /> {t('route')}
          </Button>
          <Button
            variant="outline" size="icon" onClick={toggleSave} disabled={saving}
            aria-pressed={saved} aria-label={saved ? t('saved-remove') : t('save-place')}
          >
            <Star className={cn('size-4', saved && 'fill-yellow-400 text-yellow-400')} />
          </Button>
          <Button variant="outline" size="icon" onClick={share} aria-label={t('share-place')}>
            <Share2 className="size-4" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2 pt-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (details?.openingHours || details?.phone || details?.website || details?.cuisine || details?.wheelchair) ? (
          <>
            <Separator />
            <dl className="space-y-2 text-[13px]">
              {details.openingHours && (
                <Row icon={<Clock className="size-4" />} label={t('opening-hours')}>
                  <span className="tabular-nums">{details.openingHours}</span>
                </Row>
              )}
              {details.phone && (
                <Row icon={<Phone className="size-4" />} label={t('phone')}>
                  <a className="text-primary hover:underline" href={`tel:${details.phone.replace(/\s/g, '')}`}>
                    {details.phone}
                  </a>
                </Row>
              )}
              {details.website && (
                <Row icon={<Globe className="size-4" />} label={t('website')}>
                  <a
                    className="truncate text-primary hover:underline"
                    href={details.website} target="_blank" rel="noreferrer noopener"
                  >
                    {details.website.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                </Row>
              )}
              {details.cuisine && (
                <Row icon={<UtensilsCrossed className="size-4" />} label={t('cuisine')}>
                  <span className="capitalize">{details.cuisine.replace(/[_;]/g, ' ')}</span>
                </Row>
              )}
              {details.wheelchair && (
                <Row icon={<Accessibility className="size-4" />} label={t('wheelchair')}>
                  {details.wheelchair === 'yes' ? t('yes')
                    : details.wheelchair === 'limited' ? t('limited')
                    : details.wheelchair === 'no' ? t('no') : details.wheelchair}
                </Row>
              )}
            </dl>
          </>
        ) : null}

        <p className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground/70">
          <MapPin className="size-3" />
          {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
        </p>
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-px text-muted-foreground" aria-hidden="true">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}
