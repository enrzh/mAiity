/// Typed client for the maps API. Web platform: the refresh token lives in an
/// httpOnly cookie (scoped to /maps/api/auth); the short-lived access token is
/// kept in memory only and transparently renewed on 401.
///
/// Dev is same-origin via the vite proxy (see vite.config.ts), so cookies and
/// CORS behave exactly like production.

const API = '/maps/api'

export interface User { id: string; email: string | null; displayName: string | null }
export interface Bookmark {
  id: string; name: string; lat: number; lon: number
  icon: string; note: string; createdAt: number; updatedAt: number
}
export interface Pack {
  id: string; name: string; version: string; description: string
  styleUrl: string; preview?: { colors?: string[] }; custom?: boolean
}
export interface GeoResult { name: string; label: string; lat: number; lon: number; kind: string }
export interface PlaceDetails extends GeoResult {
  street?: string | null
  postcode?: string | null
  city?: string | null
  phone?: string | null
  website?: string | null
  openingHours?: string | null
  cuisine?: string | null
  wheelchair?: string | null
}
export interface RouteStep { instruction: string; distanceM: number; durationS: number }
export interface RouteResult {
  mode: string; distanceM: number; durationS: number
  geometry: [number, number][]; steps: RouteStep[]
}
export type RouteMode = 'car' | 'bike' | 'foot'

export const NEARBY_CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', emoji: '🍽️' },
  { id: 'cafe', label: 'Cafés', emoji: '☕' },
  { id: 'supermarket', label: 'Supermärkte', emoji: '🛒' },
  { id: 'fuel', label: 'Tankstellen', emoji: '⛽' },
  { id: 'pharmacy', label: 'Apotheken', emoji: '💊' },
  { id: 'hotel', label: 'Hotels', emoji: '🛏️' },
  { id: 'parking', label: 'Parken', emoji: '🅿️' },
  { id: 'atm', label: 'Geldautomaten', emoji: '🏧' },
] as const
export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number]['id']

let accessToken: string | null = null

export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code) }
}

async function parseError(res: Response): Promise<never> {
  let code = `http_${res.status}`
  try { code = (await res.json()).error ?? code } catch { /* keep fallback */ }
  throw new ApiError(code, res.status)
}

// ---- Session ---------------------------------------------------------------

interface SessionResponse { accessToken: string; user: User }

async function sessionCall(path: string, body?: unknown): Promise<SessionResponse> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    // Always send a JSON body — a bodyless request with a JSON content-type
    // is a 400 in Fastify (FST_ERR_CTP_EMPTY_JSON_BODY).
    headers: { 'Content-Type': 'application/json', 'x-client-platform': 'web' },
    credentials: 'include',
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) return parseError(res)
  const data = (await res.json()) as SessionResponse
  accessToken = data.accessToken
  return data
}

/// Single-flight refresh: concurrent 401s (or StrictMode double-boot) share
/// ONE request — the server treats rapid re-use of a rotated token as theft.
/// Web Locks serialize refreshes across tabs sharing the same cookie.
let refreshInFlight: Promise<SessionResponse> | null = null
function refreshSession(): Promise<SessionResponse> {
  if (!refreshInFlight) {
    const run = () => sessionCall('/auth/refresh')
    refreshInFlight = (
      'locks' in navigator
        ? navigator.locks.request('maps-refresh', run)
        : run()
    ).finally(() => { refreshInFlight = null }) as Promise<SessionResponse>
  }
  return refreshInFlight
}

export const session = {
  register: (email: string, password: string) => sessionCall('/auth/register', { email, password }),
  login: (email: string, password: string) => sessionCall('/auth/login', { email, password }),
  /** Resume from the refresh cookie; null when there is no valid session. */
  async resume(): Promise<User | null> {
    try { return (await refreshSession()).user } catch { return null }
  },
  /** Best-effort server logout — local session is cleared even when offline. */
  async logout(): Promise<void> {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-platform': 'web' },
        credentials: 'include',
        body: '{}',
      })
    } catch { /* offline logout must still clear local state */ }
    finally { accessToken = null }
  },
}

/** Authenticated fetch with a single transparent refresh-retry on 401. */
async function authed(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      // JSON content-type only when a body is actually sent (see above).
      ...(init.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (res.status === 401 && !retried) {
    try { await refreshSession() } catch { return res }
    return authed(path, init, true)
  }
  return res
}

// ---- Data ------------------------------------------------------------------

export const api = {
  async bookmarks(): Promise<Bookmark[]> {
    const res = await authed('/bookmarks')
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async addBookmark(b: { name: string; lat: number; lon: number; icon?: string; note?: string }): Promise<Bookmark> {
    const res = await authed('/bookmarks', { method: 'POST', body: JSON.stringify(b) })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async deleteBookmark(id: string): Promise<void> {
    const res = await authed(`/bookmarks/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) return parseError(res)
  },
  async renameBookmark(id: string, name: string): Promise<Bookmark> {
    const res = await authed(`/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
    if (!res.ok) return parseError(res)
    return res.json()
  },

  async packs(): Promise<Pack[]> {
    const res = await fetch(`${API}/packs`)
    if (!res.ok) return parseError(res)
    return (await res.json()).packs
  },

  async geocode(q: string, bias?: { lat: number; lon: number }): Promise<GeoResult[]> {
    const p = new URLSearchParams({ q, limit: '7' })
    if (bias) { p.set('lat', String(bias.lat)); p.set('lon', String(bias.lon)) }
    const res = await fetch(`${API}/geocode?${p}`)
    if (!res.ok) return parseError(res)
    return (await res.json()).results
  },
  async nearby(cat: NearbyCategory, lat: number, lon: number): Promise<GeoResult[]> {
    const res = await fetch(`${API}/nearby?cat=${cat}&lat=${lat}&lon=${lon}`)
    if (!res.ok) return parseError(res)
    return (await res.json()).results
  },
  /** Full details for a place (OSM data, else reverse-geocoded address). */
  async place(lat: number, lon: number, name?: string): Promise<PlaceDetails | null> {
    const p = new URLSearchParams({ lat: String(lat), lon: String(lon) })
    if (name) p.set('name', name)
    try {
      const res = await fetch(`${API}/place?${p}`)
      if (!res.ok) return null
      return (await res.json()).place
    } catch { return null }
  },
  async reverse(lat: number, lon: number): Promise<GeoResult | null> {
    try {
      const res = await fetch(`${API}/reverse?lat=${lat}&lon=${lon}`)
      if (!res.ok) return null
      return (await res.json()).results[0] ?? null
    } catch { return null }
  },

  async route(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
    mode: RouteMode,
  ): Promise<RouteResult> {
    const res = await fetch(`${API}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, mode }),
    })
    if (!res.ok) return parseError(res)
    return res.json()
  },

  async userPacks(): Promise<Pack[]> {
    const res = await authed('/user/packs')
    if (!res.ok) return parseError(res)
    return (await res.json()).packs
  },
  async installPack(body: { name: string; styleUrl?: string; styleJson?: string }): Promise<Pack> {
    const res = await authed('/user/packs', { method: 'POST', body: JSON.stringify(body) })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async deletePack(id: string): Promise<void> {
    const res = await authed(`/user/packs/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) return parseError(res)
  },

  async saveSettings(s: { activePack?: string; camera?: unknown }): Promise<void> {
    const res = await authed('/user/settings', { method: 'PUT', body: JSON.stringify(s) })
    if (!res.ok) return parseError(res)
  },
  async settings(): Promise<{ activePack: string | null }> {
    const res = await authed('/user/settings')
    if (!res.ok) return { activePack: null }
    return res.json()
  },
}

/** Resolve a pack's styleUrl (site-relative; same-origin in dev via proxy). */
export function styleUrlFor(pack: Pack): string {
  return pack.styleUrl
}
