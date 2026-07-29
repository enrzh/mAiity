import type { Place } from '../state'

export type MapProvider = 'apple' | 'custom'
export type AppleMapType = 'standard' | 'muted' | 'satellite' | 'hybrid'
export type AppleColorScheme = 'adaptive' | 'light' | 'dark'
export type AppleOverlayTone = 'none' | 'cool' | 'warm' | 'reduced-color'

export interface MapPreferences {
  version: 1
  provider: MapProvider
  customPackId: string
  appleMapType: AppleMapType
  appleColorScheme: AppleColorScheme
  appleOverlayTone: AppleOverlayTone
}

export interface MapViewport {
  center: { lat: number; lon: number }
  latitudeDelta: number
  longitudeDelta: number
}

export interface MapRendererCapabilities {
  threeD: boolean
  mapClick: boolean
  routes: boolean
  bookmarks: boolean
  nativeControls: boolean
}

export interface MapRendererController {
  readonly provider: MapProvider
  readonly capabilities: MapRendererCapabilities
  zoomBy(delta: number): void
  locate(): void
  set3D(on: boolean): void
  focusPlace(place: Place): void
  showPlaces(places: Place[]): void
  getViewport(): MapViewport | null
}

