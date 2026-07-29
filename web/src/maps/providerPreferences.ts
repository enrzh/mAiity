import type { MapPreferences } from './types'

const KEY = 'maps.preferences.v1'

export const DEFAULT_MAP_PREFERENCES: MapPreferences = {
  version: 1,
  // MapLibre packs are the reliable default. Apple MapKit JS remains available
  // as an opt-in provider (annotation lifecycle is fragile in MapKit JS).
  provider: 'custom',
  customPackId: 'dark',
  appleMapType: 'standard',
  appleColorScheme: 'adaptive',
  appleOverlayTone: 'none',
}

const providers = new Set(['apple', 'custom'])
const mapTypes = new Set(['standard', 'muted', 'satellite', 'hybrid'])
const schemes = new Set(['adaptive', 'light', 'dark'])
const tones = new Set(['none', 'cool', 'warm', 'reduced-color'])

function normalize(value: unknown): MapPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_MAP_PREFERENCES
  const v = value as Partial<MapPreferences>
  return {
    version: 1,
    provider: providers.has(v.provider ?? '') ? v.provider! : DEFAULT_MAP_PREFERENCES.provider,
    customPackId: typeof v.customPackId === 'string' && v.customPackId ? v.customPackId : DEFAULT_MAP_PREFERENCES.customPackId,
    appleMapType: mapTypes.has(v.appleMapType ?? '') ? v.appleMapType! : DEFAULT_MAP_PREFERENCES.appleMapType,
    appleColorScheme: schemes.has(v.appleColorScheme ?? '') ? v.appleColorScheme! : DEFAULT_MAP_PREFERENCES.appleColorScheme,
    appleOverlayTone: tones.has(v.appleOverlayTone ?? '') ? v.appleOverlayTone! : DEFAULT_MAP_PREFERENCES.appleOverlayTone,
  }
}

export function readMapPreferences(storage: Pick<Storage, 'getItem'> = localStorage): MapPreferences {
  try {
    const saved = storage.getItem(KEY)
    if (saved) return normalize(JSON.parse(saved))
    const legacy = storage.getItem('maps.activePack')
    if (!legacy || legacy === 'light') return DEFAULT_MAP_PREFERENCES
    return { ...DEFAULT_MAP_PREFERENCES, provider: 'custom', customPackId: legacy }
  } catch {
    return DEFAULT_MAP_PREFERENCES
  }
}

export function writeMapPreferences(
  preferences: MapPreferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  try { storage.setItem(KEY, JSON.stringify(normalize(preferences))) } catch { /* best effort */ }
}

