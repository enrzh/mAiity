import { useEffect, useRef, useState } from 'react'
import {
  BedDouble, Building2, Coffee, CreditCard, Cross, Fuel, Globe, Loader2, MapPin,
  Search, ShoppingCart, SquareParking, TreePine, Utensils, X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api, type GeoResult } from '../lib/api'
import { activeMapViewport } from '../maps/rendererController'
import { useT } from '../lib/useT'
import { useApp } from '../state'

/// Result-type glyph — a quick visual scent of WHAT each hit is before
/// reading its label. Admin places by rank, POIs by kind, pin otherwise.
function ResultIcon({ r }: { r: GeoResult }) {
  const cls = 'size-4 shrink-0 text-muted-foreground'
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

/// Debounced typeahead against /api/geocode. Distinguishes "no results" from
/// "search unavailable"; Enter only picks from a live, open result list.
export function SearchBar() {
  const app = useApp()
  const t = useT()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  // Keyboard cursor into the open result list; Enter picks it (default: first).
  const [activeIndex, setActiveIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const seq = useRef(0)
  // Picking a result writes its name back into the input — that must not
  // re-trigger the debounce and reopen the dropdown 350ms later.
  const suppressRef = useRef<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const query = q.trim()
    if (suppressRef.current !== null && query === suppressRef.current) {
      suppressRef.current = null
      return
    }
    suppressRef.current = null
    if (query.length < 2) {
      // Invalidate any in-flight request — a stale response must not reopen
      // the dropdown, and the spinner must not stick.
      seq.current++
      setBusy(false)
      setError(false)
      setResults([])
      setOpen(false)
      return
    }
    const mySeq = ++seq.current
    setBusy(true)
    setError(false)
    // Abort the previous in-flight request instead of letting it finish and
    // be discarded — frees the connection and cuts typeahead latency.
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        // Bias to what the user is looking at. Without this, "Rheinpark"
        // ranked by global importance — a park 400km away could outrank the
        // one on screen. (City/country queries are protected from over-biasing
        // server-side by the place-boost re-rank.)
        const c = activeMapViewport()?.center
        const res = await api.geocode(query, c ?? undefined, ctrl.signal)
        if (seq.current !== mySeq) return // stale — a newer query is running
        setResults(res)
        setActiveIndex(0) // fresh list — cursor back to the top hit
        setOpen(true)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        if (seq.current === mySeq) { setResults([]); setError(true); setOpen(true) }
      } finally {
        if (seq.current === mySeq) setBusy(false)
      }
    }, 200)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  // Click-away closes the dropdown.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const pick = (r: GeoResult) => {
    app.selectResult(r)
    setOpen(false)
    suppressRef.current = r.name.trim()
    seq.current++
    setBusy(false)
    setQ(r.name)
    // Remember for the recents dropdown (dedup by coords, cap 8).
    try {
      const cur: GeoResult[] = JSON.parse(localStorage.getItem('maps.recents') ?? '[]')
      const next = [r, ...cur.filter((x) => x.lat !== r.lat || x.lon !== r.lon)].slice(0, 8)
      localStorage.setItem('maps.recents', JSON.stringify(next))
    } catch { /* storage full/blocked — recents are best-effort */ }
  }

  const recents = (): GeoResult[] => {
    try { return JSON.parse(localStorage.getItem('maps.recents') ?? '[]') } catch { return [] }
  }
  const [showRecents, setShowRecents] = useState(false)

  const clear = () => {
    seq.current++
    setQ(''); setResults([]); setOpen(false); setBusy(false); setError(false)
    app.select(null)
  }

  // Keep the keyboard-active row visible while cycling through a long list.
  useEffect(() => {
    if (!open) return
    document.getElementById(`search-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const listInteractive = open && !busy && !error && results.length > 0
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setResults([]); return }
    if (!listInteractive) return
    const last = results.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i >= last ? 0 : i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i <= 0 ? last : i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(last)
        break
      case 'Enter':
        pick(results[Math.min(activeIndex, last)] ?? results[0])
        break
    }
  }

  return (
    <div className="relative min-w-0 max-w-[420px] flex-1" ref={boxRef}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </span>
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-activedescendant={listInteractive ? `search-option-${activeIndex}` : undefined}
          // Solid: this input sits ON the solid rail surface — a translucent,
          // blurred field over an already-opaque panel just muddies the text.
          className="h-11 rounded-full bg-background pl-9 pr-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
            else if (q.trim().length === 0 && recents().length > 0) setShowRecents(true)
          }}
          onBlur={() => setTimeout(() => setShowRecents(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={t('search-placeholder')}
          aria-label={t('search')}
        />
        {q && (
          <Button
            variant="ghost" size="icon-sm"
            className="absolute right-1.5 top-1/2 size-7 -translate-y-1/2 rounded-full text-muted-foreground"
            onClick={clear} aria-label={t('search-clear')}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {!open && showRecents && (
        <ul className="absolute z-30 mt-2 w-full rounded-xl border bg-popover p-1.5 shadow-xl">
          <li className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('recent-searches')}
          </li>
          {recents().map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`}>
              <button
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-accent"
                onMouseDown={(e) => { e.preventDefault(); pick(r); setShowRecents(false) }}
              >
                <span className="text-sm font-semibold">{r.name}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <ul
          id="search-results"
          role="listbox"
          aria-label={t('search')}
          className="absolute z-30 mt-2 max-h-[50vh] w-full overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl"
        >
          {error ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              {t('search-unavailable')}
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{t('no-results')}</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  id={`search-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-accent',
                    i === activeIndex && 'bg-accent',
                  )}
                  onClick={() => pick(r)}
                  onMouseMove={() => setActiveIndex(i)}
                >
                  <ResultIcon r={r} />
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="text-sm font-semibold">{r.name}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{r.label}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
