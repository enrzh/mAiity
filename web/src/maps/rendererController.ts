import type { MapRendererCapabilities, MapRendererController, NavFollowState } from './types'
import type { Place } from '../state'

let active: MapRendererController | null = null

export function registerMapRenderer(controller: MapRendererController) {
  active = controller
  return () => {
    if (active === controller) active = null
  }
}

export const activeMapCapabilities = (): MapRendererCapabilities | null => active?.capabilities ?? null
export const activeMapViewport = () => active?.getViewport() ?? null

/** Project lon/lat to CSS pixel position in the map container (or null). */
export function projectActiveMapToScreen(lon: number, lat: number): { x: number; y: number } | null {
  return active?.projectToScreen?.(lon, lat) ?? null
}
export const zoomActiveMap = (delta: number) => active?.zoomBy(delta)
export const locateActiveMap = () => active?.locate()
export const setActiveMap3D = (on: boolean) => active?.set3D(on)
export const focusActiveMapPlace = (place: Place) => active?.focusPlace(place)
export const showActiveMapPlaces = (places: Place[]) => active?.showPlaces(places)
export const followActiveNavigation = (state: NavFollowState) => active?.followNavigation?.(state)
export const subscribeActiveMapMoveEnd = (listener: () => void): (() => void) =>
  active?.subscribeMoveEnd?.(listener) ?? (() => {})

/** Soft free-drive collision geometry (empty on Apple / no tiles). */
export const queryActiveMapBuildingsNear = (lon: number, lat: number, radiusM = 48) =>
  active?.queryBuildingsNear?.(lon, lat, radiusM) ?? []

