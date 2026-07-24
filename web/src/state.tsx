import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  api, session, styleUrlFor,
  type Bookmark, type GeoResult, type NearbyCategory, type Pack,
  type RouteMode, type RouteResult, type User,
} from './lib/api'

export interface Place { name: string; label: string; lat: number; lon: number }

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface RouteState {
  /** Explicit start, or null = the user's current location. */
  from: Place | null
  to: Place
  mode: RouteMode
  status: 'loading' | 'ready' | 'error'
  errorText?: string
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
  showCategory: (cat: NearbyCategory, center: { lat: number; lon: number }) => Promise<void>
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

  // Async-write guards: a session epoch (bumped on login/logout) plus a
  // bookmark mutation counter — stale fetches must never clobber newer state.
  const epoch = useRef(0)
  const bmVersion = useRef(0)

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

  const loadBookmarks = useCallback(() => {
    const e = epoch.current
    const v = bmVersion.current
    setBookmarksStatus('loading')
    api.bookmarks()
      .then((list) => {
        // Discard when the session changed or a local mutation happened since.
        if (e !== epoch.current || v !== bmVersion.current) return
        setBookmarks(list)
        setBookmarksStatus('ready')
      })
      .catch(() => { if (e === epoch.current) setBookmarksStatus('error') })
  }, [])

  // Boot: packs + resume session (cookie) + user data.
  useEffect(() => {
    loadPacks()
    const e = epoch.current
    session.resume().then(async (u) => {
      if (!u || e !== epoch.current) return
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
      setRoute(null)
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
    setSelected(p)
  }, [])
  const selectResult = useCallback((r: GeoResult) => {
    const place = { name: r.name, label: r.label, lat: r.lat, lon: r.lon }
    if (pickingRef.current) { setRouteStartRef.current(place); return }
    setSelected(place)
  }, [])

  // Shared place links: /maps/?p=lat,lon,Name
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('p')
    if (!p) return
    const [latS, lonS, ...nameParts] = p.split(',')
    const lat = Number(latS), lon = Number(lonS)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    const name = decodeURIComponent(nameParts.join(',')) || `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    setSelected({ name, label: 'Geteilter Ort', lat, lon })
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
        notify('Löschen fehlgeschlagen — bitte erneut versuchen.')
      }
    } finally {
      setPendingDeletes((s) => { const n = new Set(s); n.delete(b.id); return n })
    }
  }, [notify])

  const removeBookmark = useCallback(async (id: string) => {
    const b = bookmarks.find((x) => x.id === id)
    if (b && !pendingDeletes.has(id)) await removeBookmarkInternal(b)
  }, [bookmarks, pendingDeletes, removeBookmarkInternal])

  // ---- Routing -------------------------------------------------------------
  const routeSeq = useRef(0)

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
          errorText: 'Standort nicht verfügbar — Startpunkt wählen oder Standortzugriff erlauben.',
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
        errorText: code === 'no_route_found'
          ? 'Keine Route gefunden.'
          : 'Routenberechnung derzeit nicht verfügbar.',
      })
    }
  }, [])

  const startRoute = useCallback((to: Place) => { void requestRoute(null, to, 'car') }, [requestRoute])
  const setRouteMode = useCallback((mode: RouteMode) => {
    setRoute((r) => { if (r) void requestRoute(r.from, r.to, mode); return r })
  }, [requestRoute])
  const setRouteStart = useCallback((from: Place | null) => {
    setRoute((r) => { if (r) void requestRoute(from, r.to, r.mode); return r })
  }, [requestRoute])
  setRouteStartRef.current = setRouteStart
  const swapRoute = useCallback(() => {
    setRoute((r) => {
      if (r?.from) void requestRoute(r.to, r.from, r.mode)
      return r
    })
  }, [requestRoute])
  const beginPickStart = useCallback(() => setPickingStart(true), [])
  const clearRoute = useCallback(() => {
    routeSeq.current++
    setRoute(null)
    setPickingStart(false)
  }, [])

  // ---- POI category browsing ----------------------------------------------
  const poiSeq = useRef(0)
  const showCategory = useCallback(async (cat: NearbyCategory, center: { lat: number; lon: number }) => {
    const seq = ++poiSeq.current
    setActiveCategory(cat)
    try {
      const results = await api.nearby(cat, center.lat, center.lon)
      if (seq !== poiSeq.current) return
      setPois(results)
      if (results.length === 0) toast.info('Nichts in der Nähe gefunden.')
    } catch {
      if (seq !== poiSeq.current) return
      setPois([])
      toast.error('Suche derzeit nicht verfügbar.')
    }
  }, [])
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
    if (activePack === id) applyPack('light')
  }, [activePack, applyPack])

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
    setAuthOpen, login, register, logout, select, selectResult,
    setActivePack, loadPacks, loadBookmarks, saveBookmark, removeBookmark, bookmarkFor,
    startRoute, setRouteMode, setRouteStart, swapRoute, beginPickStart, clearRoute,
    showCategory, clearPois, installPack, removePack,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
