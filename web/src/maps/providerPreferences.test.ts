import { describe, expect, test } from 'bun:test'
import { DEFAULT_MAP_PREFERENCES, readMapPreferences, writeMapPreferences } from './providerPreferences'

function storageFrom(values: Map<string, string>) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('map provider preferences', () => {
  test('migrates the legacy Apple light pack', () => {
    const storage = storageFrom(new Map([['maps.activePack', 'light']]))
    expect(readMapPreferences(storage)).toEqual(DEFAULT_MAP_PREFERENCES)
  })

  test('migrates a custom pack without changing its id', () => {
    const storage = storageFrom(new Map([['maps.activePack', 'neon-city']]))
    expect(readMapPreferences(storage)).toMatchObject({ provider: 'custom', customPackId: 'neon-city' })
  })

  test('round-trips and normalizes versioned preferences', () => {
    const storage = storageFrom(new Map())
    writeMapPreferences({
      version: 1,
      provider: 'apple',
      customPackId: 'dark',
      appleMapType: 'hybrid',
      appleColorScheme: 'dark',
      appleOverlayTone: 'cool',
    }, storage)
    expect(readMapPreferences(storage)).toMatchObject({
      provider: 'apple',
      appleMapType: 'hybrid',
      appleColorScheme: 'dark',
      appleOverlayTone: 'cool',
    })
  })
})

