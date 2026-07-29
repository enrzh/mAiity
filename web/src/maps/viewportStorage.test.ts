import { describe, expect, test } from 'bun:test'
import { readViewport, writeViewport } from './viewportStorage'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('map viewport persistence', () => {
  test('stores providers independently and rejects malformed state', () => {
    const storage = new MemoryStorage() as unknown as Storage
    const viewport = { center: { lat: 51.2, lon: 6.7 }, latitudeDelta: 0.2, longitudeDelta: 0.3 }
    writeViewport('apple', viewport, storage)
    expect(readViewport('apple', storage)).toEqual(viewport)
    expect(readViewport('custom', storage)).toBeNull()
    storage.setItem('maps.viewport.apple.v1', '{"center":{}}')
    expect(readViewport('apple', storage)).toBeNull()
  })
})
