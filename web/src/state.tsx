import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { makeT, type TKey } from './lib/i18n'
import {
  api, session, styleUrlFor,
  type Bookmark, type GeoResult, type NearbyCategory, type Pack,
  type RouteMode, type RouteResult, type User,
} from './lib/api'

export interface Place {
  name: string; label: string; lat: number; lon: number
  /** From search hits: result kind + admin bbox for zoom-to-fit. */
  kind?: string; extent?: [number, number, number, number]
}

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface RouteState {
  /** Explicit start, or null = the user's current location. */
  from: Place | null
  to: Place
  mode: RouteMode
  status: 'loading' | 'ready' | 'error'
  /** i18n key — the panel translates at render time so language switches apply. */
  errorKey?: TKey
  result?: RouteResult
}

interface AppState {
  user: User | null
  bookmarks: Bookmark[]
  bookmarksStatus: LoadStatus
  pendingDeletes: Set<string>
  packs: Pack[]
  packsError: boolean
  activePack: string
  activeStyleUrl: string | null
  selected: Place | null
  authOpen: boolean
  route: RouteState | null
  pickingStart: boolean
  pois: GeoResult[]
  activeCategory: string | null
  /** UI + map-label language (ISO 639-1). */
  lang: string
  setLang: (l: string) => void
  is3D: boolean
  toggle3D: () => void
  navigating: boolean
  startNavigation: () => void
  stopNavigation: () => void

  setAuthOpen: (open: boolean) => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  select: (place: Place | null) => void
  selectResult: (r: GeoResult) => void
  setActivePack: (id: string) => void
  loadPacks: () => void
  loadBookmarks: () => void
  saveBookmark: (place: Place) => Promise<boolean>
  removeBookmark: (id: string) => Promise<void>
  bookmarkFor: (place: Place) => Bookmark | undefined
  startRoute: (to: Place) => void
  setRouteMode: (mode: RouteMode) => void
  setRouteStart: (from: Place | null) => void
  swapRoute: () => void
  beginPickStart: () => void
  clearRoute: () => void
  showCategory: (
    cat: NearbyCategory,
    center: { lat: number; lon: number },
    bounds?: { west: number; south: number; east: number; north: number },
  ) => Promise<void>
  clearPois: () => void
  installPack: (body: { name: string; styleUrl?: string; styleJson?: string }) => Promise<void>
  removePack: (id: string) => Promise<void>
}

const Ctx = createContext<AppState | null>(null)
export const useApp = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

const PACK_KEY = 'maps.activePack'

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksStatus, setBookmarksStatus] = useState<LoadStatus>('ready')
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const [packs, setPacks] = useState<Pack[]>([])
  const [packsError, setPacksError] = useState(false)
  const [activePack, setActive] = useState<string>(() => localStorage.getItem(PACK_KEY) ?? 'light')
  const [selected, setSelected] = useState<Place | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [customPacks, setCustomPacks] = useState<Pack[]>([])
  const [route, setRoute] = useState<RouteState | null>(null)
  const [pickingStart, setPickingStart] = useState(false)
  const [pois, setPois] = useState<GeoResult[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  // Map-label + UI language. Tiles carry name:<lang> for 40+ languages.
  const [lang, setLangState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('maps.lang')
      if (saved) return saved
    } catch { /* private mode */ }
    const nav = (navigator.language || 'de').slice(0, 2).toLowerCase()
    return ['de', 'en', 'fr', 'es', 'it', 'nl', 'pl', 'tr'].includes(nav) ? nav : 'en'
  })
  const setLang = useCallback((l: string) => {
    setLangState(l)
    try { localStorage.setItem('maps.lang', l) } catch { /* best-effort */ }
  }, [])
  const [is3D, setIs3D] = useState(false)
  const [navigating, setNavigating] = useState(false)

  // Async-write guards: a session epoch (bumped on login/logout) plus a
  // bookmark mutation counter — stale fetches must never clobber newer state.
  const epoch = useRef(0)
  const bmVersion = useRef(0)

  // Language mirror for callbacks with empty dep arrays (toasts fire in the
  // language active at the moment they appear).
  const langRef = useRef(lang)
  langRef.current = lang
  const tr = useCallback((k: TKey) => makeT(langRef.current)(k), [])

  const notify = useCallback((msg: string) => { toast.error(msg) }, [])

  const applyPack = useCallback((id: string) => {
    setActive(id)
    localStorage.setItem(PACK_KEY, id)
  }, [])

  const loadPacks = useCallback(() => {
    api.packs()
      .then((p) => { setPacks(p); setPacksError(false) })
      .catch(() => setPacksError(true))
  }, [])

  const loadCustomPacks = useCallback(() => {
    const e = epoch.current
    api.userPacks()
      .then((p) => { if (e === epoch.current) setCustomPacks(p) })
      .catch(() => {})
  }, [])

  const loadBookmarks = useCallback(function load() {
    const e = epoch.current
    const v = bmVersion.current
    setBookmarksStatus('loading')
    api.bookmarks()
      .then((list) => {
        if (e !== epoch.current) return // session changed — logout resets status
        if (v !== bmVersion.current) { load(); return } // mutated mid-fetch — refetch
        setBookmarks(list)
        setBookmarksStatus('ready')
      })
      .catch(() => { if (e === epoch.current) setBookmarksStatus('error') })
  }, [])

  // Boot: packs + resume session (cookie) + user data.
  useEffect(() => {
    loadPacks()
    const params = new URLSearchParams(window.location.search)
    const appleLogin = params.get('apple_login')
    if (appleLogin) {
      params.delete('apple_login')
      const query = params.toString()
      history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
      if (appleLogin !== 'success' && appleLogin !== 'cancelled') {
        notify(tr('err-apple-login-failed'))
      }
    }
    const e = epoch.current
    session.resume().then(async (u) => {
      if (!u || e !== epoch.current) {
        if (appleLogin === 'success') notify(tr('err-apple-login-failed'))
        return
      }
      setUser(u)
      loadBookmarks()
      loadCustomPacks()
      const s = await api.settings().catch(() => null)
      if (e === epoch.current && s?.activePack) applyPack(s.activePack)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const afterAuth = useCallback(async (u: User) => {
    epoch.current++
    setUser(u)
    setAuthOpen(false)
    loadBookmarks()
    loadCustomPacks()
    // Server settings win when they exist; only seed them on true first login.
    const s = await api.settings().catch(() => null)
    if (s?.activePack) {
      applyPack(s.activePack)
    } else {
      api.saveSettings({ activePack: localStorage.getItem(PACK_KEY) ?? 'light' }).catch(() => {})
    }
  }, [loadBookmarks, loadCustomPacks, applyPack])

  const login = useCallback(async (email: string, password: string) => {
    await afterAuth((await session.login(email, password)).user)
  }, [afterAuth])

  const register = useCallback(async (email: string, password: string) => {
    await afterAuth((await session.register(email, password)).user)
  }, [afterAuth])

  const logout = useCallback(async () => {
    epoch.current++
    try { await session.logout() }
    finally {
      setUser(null)
      setBookmarks([])
      setSelected(null)
      routeSeq.current++
      setRoute(null)
      setPickingStart(false) // a stuck pick mode would swallow all selections
      setCustomPacks([])
      setBookmarksStatus('ready')
      // A custom pack can't render without the account context list — fall back.
      if ((localStorage.getItem(PACK_KEY) ?? '').startsWith('u-')) applyPack('light')
    }
  }, [applyPack])

  const setActivePack = useCallback((id: string) => {
    applyPack(id)
    if (user) {
      api.saveSettings({ activePack: id }).catch((e) => {
        if (e?.status === 401) setUser(null)
      })
    }
  }, [user, applyPack])

  // While picking a route start, any place selection becomes the start point.
  // (Ref indirection: setRouteStart is declared further down in this body.)
  const pickingRef = useRef(false)
  pickingRef.current = pickingStart
  const setRouteStartRef = useRef<(p: Place | null) => void>(() => {})

  const select = useCallback((p: Place | null) => {
    if (p && pickingRef.current) { setRouteStartRef.current(p); return }
    // Selecting a place during an active route means inspecting it — end the
    // route so the place card (hidden behind the route panel) can show.
    if (p && routeRef.current) { routeSeq.current++; setRoute(null) }
    setSelected(p)
  }, [])
  const selectResult = useCallback((r: GeoResult) => {
    const place = { name: r.name, label: r.label, lat: r.lat, lon: r.lon, kind: r.kind, extent: r.extent }
    if (pickingRef.current) { setRouteStartRef.current(place); return }
    if (routeRef.current) { routeSeq.current++; setRoute(null) }
    setSelected(place)
  }, [])

  // Shared place links: /maps/?p=lat,lon,Name
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('p')
    if (!p) return
    const [latS, lonS, ...nameParts] = p.split(',')
    const lat = Number(latS), lon = Number(lonS)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    // URLSearchParams already decoded — decoding again crashes on literal '%'.
    const name = nameParts.join(',') || `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    setSelected({ name, label: tr('shared-place'), lat, lon })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Same-place match: proximity plus name, so adjacent POIs never collide.
  const bookmarkFor = useCallback((place: Place) =>
    bookmarks.find((b) =>
      Math.abs(b.lat - place.lat) < 1e-5 && Math.abs(b.lon - place.lon) < 1e-5 && b.name === place.name),
  [bookmarks])

  /** Save (or unsave) — returns false when login is required first. */
  const saveBookmark = useCallback(async (place: Place): Promise<boolean> => {
    if (!user) { setAuthOpen(true); return false }
    const existing = bookmarkFor(place)
    if (existing) {
      await removeBookmarkInternal(existing)
    } else {
      bmVersion.current++
      const created = await api.addBookmark({ name: place.name, lat: place.lat, lon: place.lon })
      setBookmarks((bs) => [created, ...bs])
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bookmarkFor])

  /** Optimistic delete: remove locally, restore + notify on real failure. */
  const removeBookmarkInternal = useCallback(async (b: Bookmark) => {
    bmVersion.current++
    setPendingDeletes((s) => new Set(s).add(b.id))
    setBookmarks((bs) => bs.filter((x) => x.id !== b.id))
    try {
      await api.deleteBookmark(b.id)
    } catch (e) {
      const status = (e as { status?: number })?.status
      if (status !== 404) { // 404 = already gone, that's fine
        bmVersion.current++
        setBookmarks((bs) => [b, ...bs])
        notify(tr('delete-failed'))
      }
    } finally {
      setPendingDeletes((s) => { const n = new Set(s); n.delete(b.id); return n })
    }
  }, [notify, tr])

  const removeBookmark = useCallback(async (id: string) => {
    const b = bookmarks.find((x) => x.id === id)
    if (b && !pendingDeletes.has(id)) await removeBookmarkInternal(b)
  }, [bookmarks, pendingDeletes, removeBookmarkInternal])

  // ---- Routing -------------------------------------------------------------
  const routeSeq = useRef(0)
  // Mirror for callbacks: side effects inside setState updaters double-fire
  // under StrictMode, so route actions read this ref instead.
  const routeRef = useRef<RouteState | null>(null)
  routeRef.current = route

  const requestRoute = useCallback(async (fromPlace: Place | null, to: Place, mode: RouteMode) => {
    const seq = ++routeSeq.current
    setRoute({ from: fromPlace, to, mode, status: 'loading' })
    setSelected(null)
    setPickingStart(false)
    let from: { lat: number; lon: number }
    if (fromPlace) {
      from = { lat: fromPlace.lat, lon: fromPlace.lon }
    } else {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 60_000 }))
        from = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      } catch {
        if (seq !== routeSeq.current) return
        setRoute({
          from: fromPlace, to, mode, status: 'error',
          errorKey: 'route-err-no-location',
        })
        return
      }
    }
    try {
      const result = await api.route(from, to, mode)
      if (seq !== routeSeq.current) return
      setRoute({ from: fromPlace, to, mode, status: 'ready', result })
    } catch (e) {
      if (seq !== routeSeq.current) return
      const code = (e as { code?: string })?.code
      setRoute({
        from: fromPlace, to, mode, status: 'error',
        errorKey: code === 'no_route_found' ? 'route-err-not-found' : 'route-err-unavailable',
      })
    }
  }, [])

  const startRoute = useCallback((to: Place) => { void requestRoute(null, to, 'car') }, [requestRoute])
  const setRouteMode = useCallback((mode: RouteMode) => {
    const r = routeRef.current
    if (r) void requestRoute(r.from, r.to, mode)
  }, [requestRoute])
  const setRouteStart = useCallback((from: Place | null) => {
    const r = routeRef.current
    if (r) void requestRoute(from, r.to, r.mode)
    else setPickingStart(false) // stray pick mode without a route — unstick
  }, [requestRoute])
  setRouteStartRef.current = setRouteStart
  const swapRoute = useCallback(() => {
    const r = routeRef.current
    if (r?.from) void requestRoute(r.to, r.from, r.mode)
  }, [requestRoute])
  const beginPickStart = useCallback(() => setPickingStart(true), [])
  const clearRoute = useCallback(() => {
    routeSeq.current++
    setRoute(null)
    setPickingStart(false)
    setNavigating(false)
  }, [])

  // ---- POI category browsing ----------------------------------------------
  const poiSeq = useRef(0)
  const showCategory = useCallback(async (
    cat: NearbyCategory,
    center: { lat: number; lon: number },
    bounds?: { west: number; south: number; east: number; north: number },
  ) => {
    const seq = ++poiSeq.current
    setActiveCategory(cat)
    try {
      const results = await api.nearby(cat, center.lat, center.lon, bounds)
      if (seq !== poiSeq.current) return
      setPois(results)
      if (results.length === 0) toast.info(tr('nearby-none'))
    } catch {
      if (seq !== poiSeq.current) return
      setPois([])
      toast.error(tr('nearby-unavailable'))
    }
  }, [tr])
  const clearPois = useCallback(() => { poiSeq.current++; setPois([]); setActiveCategory(null) }, [])

  // ---- Custom packs (the install feature) ----------------------------------
  const installPack = useCallback(async (body: { name: string; styleUrl?: string; styleJson?: string }) => {
    const created = await api.installPack(body)
    setCustomPacks((ps) => [created, ...ps])
    applyPack(created.id)
    if (user) api.saveSettings({ activePack: created.id }).catch(() => {})
  }, [applyPack, user])

  const removePack = useCallback(async (id: string) => {
    await api.deletePack(id)
    setCustomPacks((ps) => ps.filter((p) => p.id !== id))
    if (activePack === id) {
      applyPack('light')
      // Persist the fallback, or other devices keep pointing at a dead pack.
      if (user) api.saveSettings({ activePack: 'light' }).catch(() => {})
    }
  }, [activePack, applyPack, user])

  const allPacks = useMemo(() => [...packs, ...customPacks], [packs, customPacks])

  const activeStyleUrl = useMemo(() => {
    const p = allPacks.find((x) => x.id === activePack)
      ?? allPacks.find((x) => x.id === 'light')
      ?? allPacks[0]
      ?? null
    return p ? styleUrlFor(p) : null
  }, [allPacks, activePack])

  const value: AppState = {
    user, bookmarks, bookmarksStatus, pendingDeletes, packs: allPacks, packsError,
    activePack, activeStyleUrl, selected, authOpen, route, pickingStart, pois, activeCategory,
    lang, setLang,
    is3D, toggle3D: () => setIs3D((v) => !v),
    navigating,
    startNavigation: () => setNavigating(true),
    stopNavigation: () => setNavigating(false),
    setAuthOpen, login, register, logout, select, selectResult,
    setActivePack, loadPacks, loadBookmarks, saveBookmark, removeBookmark, bookmarkFor,
    startRoute, setRouteMode, setRouteStart, swapRoute, beginPickStart, clearRoute,
    showCategory, clearPois, installPack, removePack,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
