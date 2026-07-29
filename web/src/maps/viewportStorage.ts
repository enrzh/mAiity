import type { MapProvider, MapViewport } from './types'

const key = (provider: MapProvider) => `maps.viewport.${provider}.v1`

export function readViewport(provider: MapProvider, storage: Storage = localStorage): MapViewport | null {
  try {
    const value = JSON.parse(storage.getItem(key(provider)) ?? 'null')
    if (!value?.center || !Number.isFinite(value.center.lat) || !Number.isFinite(value.center.lon)) return null
    if (!Number.isFinite(value.latitudeDelta) || !Number.isFinite(value.longitudeDelta)) return null
    return value
  } catch {
    return null
  }
}

export function writeViewport(provider: MapProvider, viewport: MapViewport, storage: Storage = localStorage) {
  try {
    storage.setItem(key(provider), JSON.stringify(viewport))
  } catch {
    // Preferences are best-effort in private browsing.
  }
}

