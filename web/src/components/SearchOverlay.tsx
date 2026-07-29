import { useEffect, useRef, useState } from 'react'
import {
  BedDouble, Building2, Coffee, CreditCard, Cross, Fuel, Globe, Loader2, MapPin,
  Search, ShoppingCart, SquareParking, TreePine, Utensils, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { api, type GeoResult } from '../lib/api'
import { activeMapViewport } from '../maps/rendererController'
import { useT } from '../lib/useT'
import { useApp } from '../state'

function ResultIcon({ r }: { r: GeoResult }) {
  const cls = 'size-4 shrink-0 text-primary'
  if (r.placeRank != null && r.placeRank <= 1) return <Globe className={cls} aria-hidden />
  if (r.placeRank != null && r.placeRank <= 4) return <Building2 className={cls} aria-hidden />
  const byKind: Record<string, typeof MapPin> = {
    restaurant: Utensils, cafe: Coffee, supermarket: ShoppingCart, hotel: BedDouble,
    pharmacy: Cross, fuel: Fuel, parking: SquareParking, atm: CreditCard,
    park: TreePine, garden: TreePine,
  }
  const Icon = byKind[r.kind] ?? MapPin
  return <Icon className={cls} aria-hidden />
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a place is selected — parent shrinks sheet & shows detail. */
  onPicked: () => void
}

/**
 * Full-screen liquid-glass search (auto-opens when the chrome search icon is tapped).
 * Picking a result closes the overlay — the place is no longer “in the list”;
 * the map + detail sheet take over.
 */
export function SearchOverlay({ open, onOpenChange, onPicked }: Props) {
  const app = useApp()
  const t = useT()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const seq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when full-screen opens
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(id)
  }, [open])

  // Reset query when closing so the next open is clean
  useEffect(() => {
    if (!open) {
      seq.current++
      setQ('')
      setResults([])
      setBusy(false)
      setError(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const query = q.trim()
    if (query.length < 2) {
      seq.current++
      setBusy(false)
      setError(false)
      setResults([])
      return
    }
    const mySeq = ++seq.current
    setBusy(true)
    setError(false)
    const ctrl = new AbortController()
    let timedOut = false
    const kill = window.setTimeout(() => { timedOut = true; ctrl.abort() }, 8_000)
    const timer = window.setTimeout(async () => {
      try {
        const c = activeMapViewport()?.center
        const res = await api.geocode(query, c ?? undefined, ctrl.signal)
        if (seq.current !== mySeq) return
        setResults(res)
        setActiveIndex(0)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          if (timedOut && seq.current === mySeq) { setResults([]); setError(true) }
          return
        }
        if (seq.current === mySeq) { setResults([]); setError(true) }
      } finally {
        window.clearTimeout(kill)
        if (seq.current === mySeq) setBusy(false)
      }
    }, 160)
    return () => { window.clearTimeout(timer); window.clearTimeout(kill); ctrl.abort() }
  }, [q, open])

  const recents = (): GeoResult[] => {
    try { return JSON.parse(localStorage.getItem('maps.recents') ?? '[]') } catch { return [] }
  }

  const pick = (r: GeoResult) => {
    app.selectResult(r)
    try {
      const cur: GeoResult[] = JSON.parse(localStorage.getItem('maps.recents') ?? '[]')
      const next = [r, ...cur.filter((x) => x.lat !== r.lat || x.lon !== r.lon)].slice(0, 8)
      localStorage.setItem('maps.recents', JSON.stringify(next))
    } catch { /* best-effort */ }
    onOpenChange(false)
    onPicked()
  }

  const listInteractive = !busy && !error && results.length > 0
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onOpenChange(false); return }
    if (!listInteractive) return
    const last = results.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i >= last ? 0 : i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i <= 0 ? last : i - 1)) }
    else if (e.key === 'Enter') pick(results[Math.min(activeIndex, last)] ?? results[0])
  }

  const recentList = !q.trim() ? recents() : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'fixed inset-0 top-0 left-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 shadow-none',
          'maps-glass-strong sm:max-w-none',
          'data-open:zoom-in-100 data-closed:zoom-out-100',
        )}
      >
        <DialogTitle className="sr-only">{t('search')}</DialogTitle>

        {/* Top search field — full width glass bar */}
        <div className="safe-area-pt flex items-center gap-2 border-b border-border/40 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 shrink-0 rounded-full px-3 font-semibold text-primary"
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </span>
            <Input
              ref={inputRef}
              role="combobox"
              data-search-input
              aria-expanded={results.length > 0}
              aria-controls="search-overlay-results"
              aria-autocomplete="list"
              aria-activedescendant={listInteractive ? `search-ov-${activeIndex}` : undefined}
              className="h-12 rounded-full border-border/50 bg-background/60 pl-10 pr-10 text-[16px] shadow-sm backdrop-blur-md"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('search-placeholder')}
              aria-label={t('search')}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {q && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full"
                onClick={() => { setQ(''); setResults([]); inputRef.current?.focus() }}
                aria-label={t('search-clear')}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-lg px-3 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {recentList.length > 0 && (
              <section aria-label={t('recent-searches')}>
                <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('recent-searches')}
                </h3>
                <ul className="space-y-0.5">
                  {recentList.map((r, i) => (
                    <li key={`r-${r.lat},${r.lon},${i}`}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-accent/80 active:bg-accent"
                        onClick={() => pick(r)}
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                          <MapPin className="size-4 text-muted-foreground" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                          <span className="block truncate text-[13px] text-muted-foreground">{r.label}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Separator className="my-3" />
              </section>
            )}

            <ul
              id="search-overlay-results"
              role="listbox"
              aria-label={t('search')}
              className="space-y-0.5"
            >
              {error ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t('search-unavailable')}
                </li>
              ) : q.trim().length >= 2 && !busy && results.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t('no-results')}
                </li>
              ) : (
                results.map((r, i) => (
                  <li key={`${r.lat},${r.lon},${i}`}>
                    <button
                      type="button"
                      id={`search-ov-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-accent/80 active:bg-accent',
                        i === activeIndex && 'bg-accent',
                      )}
                      onClick={() => pick(r)}
                      onMouseMove={() => setActiveIndex(i)}
                    >
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                        <ResultIcon r={r} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold tracking-tight">{r.name}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">{r.label}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
