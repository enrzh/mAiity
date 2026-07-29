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
  /** Map rotation in degrees (0 = north). Used to arm free-drive heading. */
  bearing?: number
}

export interface MapRendererCapabilities {
  threeD: boolean
  mapClick: boolean
  routes: boolean
  bookmarks: boolean
  nativeControls: boolean
}

/** Turn-by-turn follow camera + user position (provider-neutral). */
export interface NavFollowState {
  lat: number
  lon: number
  heading: number
}

/** Building footprints for free-drive collision (MapLibre packs). */
export interface BuildingFootprintQuery {
  ring: [number, number][]
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
  /** Project lon/lat into CSS pixels relative to the map container. */
  projectToScreen?(lon: number, lat: number): { x: number; y: number } | null
  /** Optional: chase camera during turn-by-turn (Apple + custom). */
  followNavigation?(state: NavFollowState): void
  /** Optional: fire when the user pans/zooms the map (for “search this area”). */
  subscribeMoveEnd?(listener: () => void): () => void
  /**
   * Nearby building footprints for soft collision (MapLibre Protomaps).
   * Apple / missing tiles → empty array.
   */
  queryBuildingsNear?(lon: number, lat: number, radiusM?: number): BuildingFootprintQuery[]
  /**
   * Nearby road centerline segments for soft free-drive road bias.
   * Apple / missing tiles → empty array.
   */
  queryRoadsNear?(lon: number, lat: number, radiusM?: number): Array<{ a: [number, number]; b: [number, number] }>
}

