import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api, type GeoResult } from '../lib/api'
import { useApp } from '../state'

/// Debounced typeahead against /api/geocode. Distinguishes "no results" from
/// "search unavailable"; Enter only picks from a live, open result list.
export function SearchBar() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
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
    if (query.length < 3) {
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
    const t = setTimeout(async () => {
      try {
        const res = await api.geocode(query)
        if (seq.current !== mySeq) return // stale — a newer query is running
        setResults(res)
        setOpen(true)
      } catch {
        if (seq.current === mySeq) { setResults([]); setError(true); setOpen(true) }
      } finally {
        if (seq.current === mySeq) setBusy(false)
      }
    }, 350)
    return () => clearTimeout(t)
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
          className="h-11 rounded-full bg-background/95 pl-9 pr-9 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
            else if (q.trim().length === 0 && recents().length > 0) setShowRecents(true)
          }}
          onBlur={() => setTimeout(() => setShowRecents(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && open && !busy && !error && results.length > 0) pick(results[0])
            if (e.key === 'Escape') { setOpen(false); setResults([]) }
          }}
          placeholder="Ort, Adresse suchen …"
          aria-label="Suche"
        />
        {q && (
          <Button
            variant="ghost" size="icon-sm"
            className="absolute right-1.5 top-1/2 size-7 -translate-y-1/2 rounded-full text-muted-foreground"
            onClick={clear} aria-label="Suche löschen"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {!open && showRecents && (
        <ul className="absolute z-30 mt-2 w-full rounded-xl border bg-popover p-1.5 shadow-xl">
          <li className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Zuletzt gesucht
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
          className="absolute z-30 mt-2 max-h-[50vh] w-full overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl"
        >
          {error ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              Suche derzeit nicht verfügbar — bitte später erneut versuchen.
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">Keine Ergebnisse.</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-accent"
                  onClick={() => pick(r)}
                >
                  <span className="text-sm font-semibold">{r.name}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{r.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
