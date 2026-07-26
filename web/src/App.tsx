import { useEffect, useRef, useState } from 'react'
import { Box, Check, ChevronLeft, ChevronRight, Crosshair, Globe, LogOut, Minus, Palette, Plus, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { AppProvider, useApp } from './state'
import { MapView, liveMap, locateUser, railInset, set3D, zoomBy } from './components/MapView'
import { CategoryChips, centerOf } from './components/CategoryChips'
import { SearchBar } from './components/SearchBar'
import { PlaceCard } from './components/PlaceCard'
import { PoiResults } from './components/PoiResults'
import { SearchAreaButton } from './components/SearchAreaButton'
import { RoutePanel } from './components/RoutePanel'
import { NavigationPanel } from './components/NavigationPanel'
import { SavedPanel } from './components/SavedPanel'
import { PackSwitcher } from './components/PackSwitcher'
import { AuthModal } from './components/AuthModal'

type Panel = 'none' | 'saved' | 'packs'

/// Layout: a Google-Maps-style left rail that owns search and all contextual
/// content, with the map as the hero to its right.
///
/// Surface tokens: the rail/sheet are SOLID panels (bg-background, border,
/// shadow-xl) — blur is reserved for chrome that truly floats over the map
/// (MapControls, the collapsed search overlay, the search-area pill), where
/// it earns its cost. Shadow scale: floating=shadow-lg, panels=shadow-xl.

/// Mobile bottom-sheet detents. peek shows search+chips, half/full open the
/// contextual content. Heights resolved lazily (vh depends on the viewport).
type Detent = 'peek' | 'half' | 'full'
const DETENTS: Detent[] = ['peek', 'half', 'full']
function detentPx(d: Detent): number {
  return d === 'peek' ? 130 : Math.round(window.innerHeight * (d === 'half' ? 0.45 : 0.85))
}

/// One control stack, bottom-right. The MapLibre built-ins are disabled so
/// nothing stacks on top of these (they shared the same corner).
function MapControls() {
  const app = useApp()
  const t = useT()
  const btn =
    'size-11 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/60 shadow-lg hover:bg-background'
  return (
    // On mobile the rail is a bottom sheet that would cover this stack — the
    // zoom buttons sat BEHIND it. Ride above it using the measured sheet
    // height (it changes with content), same as the iOS build. On desktop the
    // rail is a left panel, so md: puts the stack back on the bottom edge.
    <div className="absolute bottom-[calc(var(--sheet-h,0px)+1.5rem)] right-4 z-20 flex flex-col items-end gap-2.5 transition-[bottom] duration-200 md:bottom-6">
      <Button
        variant={app.is3D ? 'default' : 'ghost'}
        className={cn(btn, app.is3D && 'bg-primary text-primary-foreground hover:bg-primary/90')}
        onClick={() => { app.toggle3D(); set3D(!app.is3D) }}
        aria-label={t('view-3d')} aria-pressed={app.is3D} title={t('view-3d')}
      >
        <Box className="size-5" />
      </Button>
      <Button variant="ghost" className={btn} onClick={locateUser}
        aria-label={t('my-location')} title={t('my-location')}>
        <Crosshair className="size-5" />
      </Button>
      {/* Zoom pair, joined like a segmented control. */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur-xl">
        <Button variant="ghost" className="size-11 rounded-none hover:bg-accent"
          onClick={() => zoomBy(1)} aria-label={t('zoom-in')} title={t('zoom-in')}>
          <Plus className="size-5" />
        </Button>
        <Separator />
        <Button variant="ghost" className="size-11 rounded-none hover:bg-accent"
          onClick={() => zoomBy(-1)} aria-label={t('zoom-out')} title={t('zoom-out')}>
          <Minus className="size-5" />
        </Button>
      </div>
    </div>
  )
}

const LANGS: Array<[string, string]> = [
  ['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'],
]

function LanguageMenu({ size }: { size: string }) {
  const app = useApp()
  const t = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn(size, 'shrink-0 rounded-xl')}
          aria-label={t('language')} title={t('language')}>
          <Globe className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGS.map(([code, label]) => (
          <DropdownMenuItem key={code} onClick={() => app.setLang(code)}>
            <span className="flex-1">{label}</span>
            {app.lang === code && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/// The rail's controls, reused verbatim in the collapsed floating overlay so
/// hiding the rail never removes a capability.
function RailControls({
  panel, toggle, compact = false,
}: { panel: Panel; toggle: (p: Panel) => void; compact?: boolean }) {
  const app = useApp()
  const t = useT()
  const size = compact ? 'size-9' : 'size-10'
  return (
    <>
      <Button
        variant="ghost" size="icon"
        className={cn(size, 'shrink-0 rounded-xl', panel === 'packs' && 'bg-accent text-accent-foreground')}
        onClick={() => toggle('packs')}
        aria-label={t('map-style')} aria-pressed={panel === 'packs'} title={t('map-style')}
      >
        <Palette className="size-5" />
      </Button>
      <Button
        variant="ghost" size="icon"
        className={cn(size, 'shrink-0 rounded-xl', panel === 'saved' && 'bg-accent text-accent-foreground')}
        onClick={() => toggle('saved')}
        aria-label={t('saved-places')} aria-pressed={panel === 'saved'} title={t('saved-places')}
      >
        <Star className="size-5" />
      </Button>
      <LanguageMenu size={size} />
      {app.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={cn(size, 'shrink-0 rounded-xl font-semibold')} aria-label={`${t('account')}: ${app.user.email ?? ''}`}>
              {(app.user.email ?? '?')[0].toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{app.user.displayName ?? app.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => app.logout()}>
              <LogOut className="size-4" /> {t('sign-out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost" size="icon" className={cn(size, 'shrink-0 rounded-xl')}
          onClick={() => app.setAuthOpen(true)} aria-label={t('sign-in')} title={t('sign-in')}
        >
          <User className="size-5" />
        </Button>
      )}
    </>
  )
}

function Shell() {
  const app = useApp()
  const t = useT()
  const [panel, setPanel] = useState<Panel>('none')
  const [collapsed, setCollapsed] = useState(false)
  const railRef = useRef<HTMLElement>(null)
  const [sheetH, setSheetH] = useState(0)
  // Mobile sheet detent + live height while the grabber is being dragged.
  const [detent, setDetent] = useState<Detent>('peek')
  const [dragH, setDragH] = useState<number | null>(null)
  const dragFrom = useRef<{ y: number; h: number } | null>(null)
  const toggle = (p: Panel) => {
    // Acting on a rail function while collapsed reopens the rail to show it.
    if (collapsed) setCollapsed(false)
    // On mobile, the peek sheet has no room for panel content — lift it.
    setDetent((d) => (d === 'peek' ? 'half' : d))
    setPanel((cur) => (cur === p ? 'none' : p))
  }

  // Drag on the handle, snap to the nearest detent on release. Plain pointer
  // events (with capture) — no library needed for three snap points.
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragFrom.current = { y: e.clientY, h: railRef.current?.offsetHeight ?? detentPx(detent) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current
    if (!from) return
    const h = from.h + (from.y - e.clientY)
    setDragH(Math.min(detentPx('full'), Math.max(detentPx('peek'), h)))
  }
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current
    if (!from) return
    dragFrom.current = null
    const h = from.h + (from.y - e.clientY)
    let best: Detent = 'peek'
    for (const d of DETENTS) if (Math.abs(detentPx(d) - h) < Math.abs(detentPx(best) - h)) best = d
    setDetent(best)
    setDragH(null) // hand height control back to the detent (animated)
  }

  // A place or route takes over the rail; side panels step aside.
  useEffect(() => { if (app.selected || app.route) setPanel('none') }, [app.selected, app.route])
  // Selecting something while collapsed should reveal it, like Maps does.
  useEffect(() => { if (app.selected || app.route) setCollapsed(false) }, [app.selected, app.route])
  // Category results must take over the rail: with the packs/saved panel
  // open they loaded into a slot BELOW it in the precedence chain, so the
  // chips looked broken. One thing at a time, like Maps.
  useEffect(() => { if (app.pois.length > 0) { setPanel('none'); setCollapsed(false) } }, [app.pois])
  // New contextual content while the mobile sheet is at peek would be
  // invisible — lift to half so a tap on the map/chips visibly answers.
  useEffect(() => {
    if (app.selected || app.route || app.pois.length > 0)
      setDetent((d) => (d === 'peek' ? 'half' : d))
  }, [app.selected, app.route, app.pois])
  // Tell the map how much of its left edge the rail covers, so framing a place
  // or route puts it in the VISIBLE half rather than behind the panel. Only on
  // desktop — on mobile the rail is a bottom sheet, not a left panel.
  // How much chrome covers the map's LEFT edge: the rail when open, the
  // floating search overlay when collapsed. Top-centred chrome (the
  // "search this area" button, the pack-error banner) must centre on the
  // VISIBLE map, not the window, or it slides under that chrome on narrow
  // desktops. railInset additionally offsets camera framing.
  const [leftChrome, setLeftChrome] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => {
      const w = !mq.matches ? 0 : collapsed ? 412 : 392
      setLeftChrome(w)
      railInset.current = collapsed || !mq.matches ? 0 : 392
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [collapsed])

  // Measure the mobile sheet so the map controls can sit above it. The sheet
  // grows and shrinks with its content, so a fixed offset would be wrong.
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const mq = window.matchMedia('(min-width: 768px)')
    // Measure NOW, not only from the observer: ResizeObserver delivers on the
    // frame lifecycle, which does not run while the page is hidden, so relying
    // on it alone left the controls at offset 0 until the first repaint.
    const measure = () => setSheetH(mq.matches ? 0 : el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    mq.addEventListener('change', measure) // crossing the breakpoint flips it
    return () => { ro.disconnect(); mq.removeEventListener('change', measure) }
  }, [])

  return (
    <div
      className="relative flex h-full overflow-hidden bg-muted/30"
      style={{ '--sheet-h': `${sheetH}px`, '--left-chrome': `${leftChrome}px` } as React.CSSProperties}
    >
      {/* ---- Rail ------------------------------------------------------ */}
      <aside
        ref={railRef}
        // Height is detent-driven on mobile only; md:h-full wins on desktop
        // (its @media rule comes later in the sheet than the base class).
        style={{ '--detent-h': `${dragH ?? detentPx(detent)}px` } as React.CSSProperties}
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 flex h-[var(--detent-h)] flex-col gap-3 rounded-t-3xl border-t border-border/60 bg-background p-3 shadow-xl',
          // Snapping animates; while the finger drives, height tracks it raw.
          dragH === null && 'transition-[height] duration-300 ease-out',
          // The rail OVERLAYS the map on desktop instead of taking width from
          // it (this is what Google does). Collapsing then changes no layout,
          // so the GL canvas is never resized — animating the width made the
          // canvas resize on all ~18 frames of the transition, and every WebGL
          // buffer resize clears and repaints, which is the flicker.
          // Sliding on transform keeps it on the compositor: no layout, no
          // ResizeObserver, no tile refetch.
          'md:absolute md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-[392px] md:rounded-none md:border-r md:border-t-0 md:p-4',
          'md:transition-transform md:duration-300 md:ease-out md:will-change-transform',
          collapsed ? 'md:-translate-x-full' : 'md:translate-x-0',
        )}
      >
        {/* Grabber — the visible drag affordance for the mobile detents. */}
        <div
          className="-mb-2 -mt-1.5 flex shrink-0 cursor-grab touch-none justify-center py-1 active:cursor-grabbing md:hidden"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-hidden
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><SearchBar /></div>
          <RailControls panel={panel} toggle={toggle} />
        </div>

        <CategoryChips getCenter={() => centerOf(liveMap.current)} />

        {/* Contextual content — one thing at a time, like Maps. At peek the
            sheet is search+chips only, so its clipped remainder must not
            become a scroll trap; it scrolls in half/full (and on desktop). */}
        <div
          className={cn(
            'min-h-0 flex-1 overscroll-contain',
            detent === 'peek' ? 'overflow-y-hidden md:overflow-y-auto' : 'overflow-y-auto',
          )}
        >
          {app.navigating ? <NavigationPanel />
            : app.route ? <RoutePanel />
            : app.selected ? <PlaceCard />
            : panel === 'saved' ? <SavedPanel onClose={() => setPanel('none')} />
            : panel === 'packs' ? <PackSwitcher onClose={() => setPanel('none')} />
            : app.pois.length > 0 ? <PoiResults />
            : <EmptyRail />}
        </div>
      </aside>

      {/* ---- Map ------------------------------------------------------- */}
      <main className="relative min-w-0 flex-1">
        <MapView />

        {/* Collapsing hides the rail, never its functions: search, chips and
            the rail controls float over the map instead. */}
        {collapsed && (
          <div className="pointer-events-none absolute left-8 top-4 z-20 hidden w-[380px] max-w-[calc(100%-6rem)] flex-col gap-2 md:flex">
            {/* relative z-20 is load-bearing: backdrop-blur creates a STACKING
                CONTEXT, so the search dropdown's own z-30 is trapped inside
                this row and cannot paint over the chips below — the chips are
                a later sibling and would cover the results. Raising the row
                itself (not the dropdown) is the only thing that works. */}
            <div className="pointer-events-auto relative z-20 flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background/85 p-1.5 shadow-lg backdrop-blur-xl">
              <div className="min-w-0 flex-1"><SearchBar /></div>
              <RailControls panel={panel} toggle={toggle} compact />
            </div>
            <div className="pointer-events-auto relative z-10">
              <CategoryChips getCenter={() => centerOf(liveMap.current)} />
            </div>
          </div>
        )}

        {/* Google-style collapse handle riding the rail's edge (desktop).
            Slides with the rail on the same transform/duration so the two move
            as one piece; the rail now overlays the map, so the handle can no
            longer sit at the map's left edge. */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t('sidebar-show') : t('sidebar-hide')}
          title={collapsed ? t('sidebar-show') : t('sidebar-hide')}
          className={cn(
            // Solid like the rail it rides — it moves as one piece with it.
            'absolute top-1/2 z-40 hidden h-14 w-[22px] -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-border/60 bg-background text-muted-foreground shadow-lg transition-[left,background-color,color] duration-300 ease-out hover:bg-accent hover:text-foreground md:flex',
            collapsed ? 'md:left-0' : 'md:left-[392px]',
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>

        <SearchAreaButton />
        <MapControls />
        {app.packsError && app.packs.length === 0 && (
          <div
            className="absolute left-[calc(50%+var(--left-chrome,0px)/2)] top-4 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-destructive/30 bg-background px-4 py-2.5 text-sm text-destructive shadow-lg"
            role="alert"
          >
            {t('map-load-failed')}
            <Button size="sm" variant="destructive" onClick={() => app.loadPacks()}>{t('retry')}</Button>
          </div>
        )}
      </main>

      <AuthModal />
      <Toaster position="top-center" />
    </div>
  )
}

/** Quiet default state — hints without shouting. */
function EmptyRail() {
  const app = useApp()
  const t = useT()
  return (
    <div className="hidden h-full flex-col justify-end gap-1 px-1 pb-1 md:flex">
      <p className="text-sm font-medium text-foreground/80">
        {app.user ? t('welcome-back') : t('explore-map')}
      </p>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {t('empty-hint')}
      </p>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
