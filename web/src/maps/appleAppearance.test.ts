import { describe, expect, test } from 'bun:test'
import { appleOverlayClass, resolveAppleColorScheme, resolveAppleMapType } from './appleAppearance'

describe('Apple map appearance', () => {
  const mapkit = {
    Map: {
      MapTypes: { Standard: 'standard', MutedStandard: 'muted', Satellite: 'satellite', Hybrid: 'hybrid' },
      ColorSchemes: { Adaptive: 'adaptive', Light: 'light', Dark: 'dark' },
    },
  }

  test('maps preferences to official MapKit constants', () => {
    expect(resolveAppleMapType(mapkit, 'hybrid')).toBe('hybrid')
    expect(resolveAppleColorScheme(mapkit, 'dark')).toBe('dark')
  })

  test('uses a pointer-transparent tone layer only when requested', () => {
    expect(appleOverlayClass('none')).toBe('')
    expect(appleOverlayClass('cool')).toContain('apple-map-tone--cool')
  })
})
