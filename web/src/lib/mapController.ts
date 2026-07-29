export interface MapController {
  zoomBy(delta: number): void
  set3D(on: boolean): void
  locate(): void
}

let activeController: MapController | null = null

export function registerMapController(controller: MapController) {
  activeController = controller
  return () => {
    if (activeController === controller) activeController = null
  }
}

export const zoomActiveMap = (delta: number) => activeController?.zoomBy(delta)
export const setActiveMap3D = (on: boolean) => activeController?.set3D(on)
export const locateActiveMap = () => activeController?.locate()
