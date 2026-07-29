import type { MapRendererCapabilities, MapRendererController } from './types'
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
export const zoomActiveMap = (delta: number) => active?.zoomBy(delta)
export const locateActiveMap = () => active?.locate()
export const setActiveMap3D = (on: boolean) => active?.set3D(on)
export const focusActiveMapPlace = (place: Place) => active?.focusPlace(place)
export const showActiveMapPlaces = (places: Place[]) => active?.showPlaces(places)

