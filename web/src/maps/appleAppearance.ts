import type { AppleColorScheme, AppleMapType, AppleOverlayTone } from './types'

export function resolveAppleMapType(mapkit: any, type: AppleMapType) {
  const values = mapkit?.Map?.MapTypes ?? mapkit?.MapType ?? {}
  return {
    standard: values.Standard ?? values.standard,
    muted: values.MutedStandard ?? values.mutedStandard ?? values.Standard ?? values.standard,
    satellite: values.Satellite ?? values.satellite,
    hybrid: values.Hybrid ?? values.hybrid,
  }[type]
}

export function resolveAppleColorScheme(mapkit: any, scheme: AppleColorScheme) {
  const values = mapkit?.Map?.ColorSchemes ?? mapkit?.ColorScheme ?? {}
  return {
    adaptive: values.Adaptive ?? values.adaptive,
    light: values.Light ?? values.light,
    dark: values.Dark ?? values.dark,
  }[scheme]
}

export const appleOverlayClass = (tone: AppleOverlayTone) =>
  tone === 'none' ? '' : `apple-map-tone apple-map-tone--${tone}`

