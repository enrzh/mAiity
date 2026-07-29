import { describe, expect, test } from 'bun:test'
import {
  activeMapCapabilities,
  focusActiveMapPlace,
  followActiveNavigation,
  locateActiveMap,
  registerMapRenderer,
  setActiveMap3D,
  subscribeActiveMapMoveEnd,
  zoomActiveMap,
} from './rendererController'
import type { MapRendererController } from './types'

describe('active map renderer', () => {
  test('routes commands to the newest renderer and ignores stale cleanup', () => {
    const calls: string[] = []
    const make = (name: string): MapRendererController => ({
      provider: name === 'apple' ? 'apple' : 'custom',
      capabilities: { threeD: name !== 'apple', mapClick: true, routes: true, bookmarks: true, nativeControls: name === 'apple' },
      locate: () => calls.push(`${name}:locate`),
      set3D: (on) => calls.push(`${name}:3d:${on}`),
      zoomBy: (delta) => calls.push(`${name}:zoom:${delta}`),
      focusPlace: (place) => calls.push(`${name}:focus:${place.name}`),
      showPlaces: () => {},
      getViewport: () => null,
      followNavigation: (s) => calls.push(`${name}:follow:${s.lat.toFixed(2)}`),
      subscribeMoveEnd: (listener) => {
        calls.push(`${name}:sub`)
        listener()
        return () => calls.push(`${name}:unsub`)
      },
    })
    const unregisterFirst = registerMapRenderer(make('custom'))
    const unregisterSecond = registerMapRenderer(make('apple'))
    unregisterFirst()
    locateActiveMap()
    setActiveMap3D(true)
    zoomActiveMap(1)
    focusActiveMapPlace({ name: 'Köln', label: '', lat: 50.94, lon: 6.95 })
    followActiveNavigation({ lat: 50.94, lon: 6.95, heading: 90 })
    const unsub = subscribeActiveMapMoveEnd(() => {})
    unsub()
    expect(activeMapCapabilities()?.threeD).toBe(false)
    expect(calls).toEqual([
      'apple:locate', 'apple:3d:true', 'apple:zoom:1', 'apple:focus:Köln',
      'apple:follow:50.94', 'apple:sub', 'apple:unsub',
    ])
    unregisterSecond()
  })
})

