# mAiity Map Provider Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Apple Maps and Custom Maps fully usable, predictable providers on web and iOS, with shared selection, camera, location, bookmark, POI, route, persistence, loading, and accessibility behavior.

**Architecture:** Separate the map provider (`apple` or `custom`) from the visual style. Introduce a renderer adapter contract for imperative camera and location operations, while app state remains the single source of truth for selections, routes, POIs, bookmarks, language, and navigation. Apple Maps uses only supported Apple map types/color schemes plus optional non-destructive appearance overlays; complete skins remain MapLibre styles.

**Tech Stack:** React 19, TypeScript, Vite, MapKit JS 6, MapLibre GL JS 5, SwiftUI, MapKit, MapLibreSwiftUI, Bun tests, XcodeGen.

## Global Constraints

- Keep the map as the primary working surface.
- Preserve search, routing, saved places, categories, location, and navigation on both providers.
- Do not present Apple Maps as a MapLibre skin.
- Do not use unsupported CSS filters to recolor the MapKit canvas.
- Apple appearance options are limited to supported map types, color schemes, POI visibility, tint, and optional pointer-transparent overlays.
- Keep Apple attribution and MapLibre/OpenStreetMap attribution visible.
- Web controls must meet WCAG AA and support keyboard navigation.
- Native controls must respect safe areas, Dynamic Type, VoiceOver, reduced motion, and 44-point minimum targets.
- Do not add another state-management dependency.
- Every task must leave the web build passing; native tasks must leave the Xcode build passing.

---

## File Structure

### New web modules

- `web/src/maps/types.ts` — provider, appearance, viewport, and renderer capability types.
- `web/src/maps/providerPreferences.ts` — versioned local persistence and legacy `maps.activePack` migration.
- `web/src/maps/rendererController.ts` — active renderer registration and capability-aware commands.
- `web/src/maps/appleAppearance.ts` — pure mapping from Apple appearance IDs to MapKit options.
- `web/src/maps/appleAnnotations.ts` — create and reconcile selected, POI, bookmark, and user annotations.
- `web/src/maps/appleRoute.ts` — create and reconcile the MapKit route overlay.
- `web/src/components/MapProviderPicker.tsx` — provider selector and provider-specific appearance controls.
- `web/src/components/MapStatus.tsx` — loading, degraded, and retry UI.
- `web/src/components/MapLibreMapView.tsx` — isolated, lazily loaded MapLibre renderer.

### Existing web modules to modify

- `web/src/state.tsx` — provider/appearance state, persistence, and removal of the duplicated session-resume call.
- `web/src/components/MapView.tsx` — lazy renderer selection and shared adapter registration.
- `web/src/components/AppleMapView.tsx` — full app-state synchronization and interaction support.
- `web/src/components/PackSwitcher.tsx` — custom styles only.
- `web/src/App.tsx` — provider-aware controls, status, and responsive layout.
- `web/src/index.css` — provider picker, status, overlay, focus, and responsive styles.

### Native modules to modify or create

- `ios/MapsApp/Models.swift` — provider and Apple appearance models.
- `ios/MapsApp/AppModel.swift` — persisted provider/appearance selection.
- `ios/MapsApp/MapScreen.swift` — Apple map selection, camera, controls, and appearance.
- `ios/MapsApp/CustomMapScreen.swift` — shared provider behavior and camera reporting.
- `ios/MapsApp/PackPickerSheet.swift` — split provider selection from custom pack selection.
- `ios/MapsApp/MapProviderSheet.swift` — new provider and appearance UI.
- `ios/MapsApp/MapPersistence.swift` — versioned `UserDefaults` persistence.

---

### Task 1: Separate Provider, Appearance, and Custom Pack State

**Files:**
- Create: `web/src/maps/types.ts`
- Create: `web/src/maps/providerPreferences.ts`
- Modify: `web/src/state.tsx`
- Test: `web/src/maps/providerPreferences.test.ts`

**Interfaces:**
- Produces:

```ts
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
```

- Consumes: existing `Pack`, `activePack`, and `setActivePack` behavior.

- [ ] **Step 1: Write failing persistence and migration tests**

```ts
import { describe, expect, test } from 'bun:test'
import { readMapPreferences, writeMapPreferences } from './providerPreferences'

test('migrates the legacy Apple light pack to the Apple provider', () => {
  const values = new Map([['maps.activePack', 'light']])
  const storage = storageFrom(values)
  expect(readMapPreferences(storage)).toMatchObject({
    provider: 'apple',
    customPackId: 'dark',
    appleMapType: 'standard',
  })
})

test('migrates a custom pack without changing its id', () => {
  const storage = storageFrom(new Map([['maps.activePack', 'neon-city']]))
  expect(readMapPreferences(storage)).toMatchObject({
    provider: 'custom',
    customPackId: 'neon-city',
  })
})

test('round-trips versioned preferences', () => {
  const storage = storageFrom(new Map())
  writeMapPreferences({
    version: 1,
    provider: 'apple',
    customPackId: 'dark',
    appleMapType: 'hybrid',
    appleColorScheme: 'adaptive',
    appleOverlayTone: 'none',
  }, storage)
  expect(readMapPreferences(storage).appleMapType).toBe('hybrid')
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
cd web
bun test src/maps/providerPreferences.test.ts
```

Expected: FAIL because the preference module does not exist.

- [ ] **Step 3: Implement the preference types and versioned migration**

```ts
const KEY = 'maps.preferences.v1'

export const DEFAULT_MAP_PREFERENCES: MapPreferences = {
  version: 1,
  provider: 'apple',
  customPackId: 'dark',
  appleMapType: 'standard',
  appleColorScheme: 'adaptive',
  appleOverlayTone: 'none',
}

export function readMapPreferences(storage: Pick<Storage, 'getItem'>): MapPreferences {
  const saved = storage.getItem(KEY)
  if (saved) return normalizePreferences(JSON.parse(saved))
  const legacy = storage.getItem('maps.activePack')
  if (!legacy || legacy === 'light') return DEFAULT_MAP_PREFERENCES
  return { ...DEFAULT_MAP_PREFERENCES, provider: 'custom', customPackId: legacy }
}

export function writeMapPreferences(
  preferences: MapPreferences,
  storage: Pick<Storage, 'setItem'>,
) {
  storage.setItem(KEY, JSON.stringify(preferences))
}
```

- [ ] **Step 4: Replace overloaded `activePack` state**

Expose these state members:

```ts
mapPreferences: MapPreferences
setMapProvider(provider: MapProvider): void
setAppleAppearance(patch: Partial<Pick<
  MapPreferences,
  'appleMapType' | 'appleColorScheme' | 'appleOverlayTone'
>>): void
setCustomPack(id: string): void
```

Keep `activeStyleUrl` derived only from `mapPreferences.customPackId`. Remove the duplicated `session.resume().then(...)` line currently present in `state.tsx`.

- [ ] **Step 5: Run tests and build**

```bash
cd web
bun test src/maps/providerPreferences.test.ts
npm run build
```

Expected: tests PASS and Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/maps web/src/state.tsx
git commit -m "refactor: separate map provider and appearance state"
```

---

### Task 2: Replace the Minimal Controller with a Renderer Contract

**Files:**
- Create: `web/src/maps/rendererController.ts`
- Delete: `web/src/lib/mapController.ts`
- Modify: `web/src/components/MapView.tsx`
- Modify: `web/src/components/AppleMapView.tsx`
- Test: `web/src/maps/rendererController.test.ts`

**Interfaces:**
- Produces:

```ts
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
```

- [ ] **Step 1: Write failing active-renderer tests**

Test registration replacement, stale cleanup, capability reads, `focusPlace`, and safe no-op behavior when no renderer is mounted.

- [ ] **Step 2: Confirm the tests fail**

```bash
cd web
bun test src/maps/rendererController.test.ts
```

- [ ] **Step 3: Implement one active renderer registry**

```ts
let active: MapRendererController | null = null

export function registerMapRenderer(controller: MapRendererController) {
  active = controller
  return () => {
    if (active === controller) active = null
  }
}

export const activeMapCapabilities = () => active?.capabilities ?? null
export const activeMapViewport = () => active?.getViewport() ?? null
export const focusActiveMapPlace = (place: Place) => active?.focusPlace(place)
```

- [ ] **Step 4: Update both renderers to implement the same contract**

Apple capabilities must report `threeD: false` on web. MapLibre reports its existing 3D support.

- [ ] **Step 5: Run focused tests and build**

```bash
cd web
bun test src/maps/rendererController.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/src/maps web/src/components/MapView.tsx web/src/components/AppleMapView.tsx web/src/lib/mapController.ts
git commit -m "refactor: add capability-aware map renderer contract"
```

---

### Task 3: Complete Apple MapKit JS Feature Parity

**Files:**
- Create: `web/src/maps/appleAnnotations.ts`
- Create: `web/src/maps/appleRoute.ts`
- Modify: `web/src/components/AppleMapView.tsx`
- Test: `web/src/maps/appleAnnotations.test.ts`
- Test: `web/src/maps/appleRoute.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AppleAnnotationSet {
  selected: any | null
  user: any | null
  pois: Map<string, any>
  bookmarks: Map<string, any>
}

export function reconcileAppleAnnotations(
  map: any,
  mapkit: any,
  current: AppleAnnotationSet,
  input: {
    selected: Place | null
    pois: GeoResult[]
    bookmarks: Bookmark[]
    onSelect(place: Place): void
  },
): AppleAnnotationSet

export function reconcileAppleRoute(
  map: any,
  mapkit: any,
  current: any | null,
  geometry: [number, number][] | null,
): any | null
```

- [ ] **Step 1: Write failing reconciliation tests**

Cover:

- selecting a search result creates exactly one red selected marker;
- changing selection replaces only the selected marker;
- POI updates do not delete bookmarks or the user marker;
- annotation selection calls `app.select`;
- clearing a route removes its overlay;
- a ready route creates one blue polyline.

- [ ] **Step 2: Run and confirm failures**

```bash
cd web
bun test src/maps/appleAnnotations.test.ts src/maps/appleRoute.test.ts
```

- [ ] **Step 3: Implement role-based annotation reconciliation**

Do not call `map.removeAnnotations(map.annotations)`. Maintain annotation ownership by role so one state update cannot erase unrelated markers.

- [ ] **Step 4: Synchronize selected places and camera**

```ts
useEffect(() => {
  if (!map || !app.selected) return
  const coordinate = new mk.Coordinate(app.selected.lat, app.selected.lon)
  const selectedAnnotation = reconcileSelectedAnnotation(...)
  if (app.selected.extent) {
    map.showItems([selectedAnnotation], { animate: true, padding: APPLE_FRAME_PADDING })
  } else {
    map.setRegionAnimated(
      new mk.CoordinateRegion(coordinate, new mk.CoordinateSpan(0.08, 0.08)),
      true,
    )
  }
}, [map, app.selected])
```

- [ ] **Step 5: Add map and annotation interaction**

Register MapKit events once:

- map click reverse-geocodes and calls `app.select`;
- POI annotation selection calls `app.selectResult`;
- bookmark annotation selection calls `app.select`;
- route start-picking uses the same selection path.

Use a monotonically increasing click sequence so stale reverse-geocoder responses cannot overwrite a newer click.

- [ ] **Step 6: Render and frame route geometry**

Create a `mapkit.PolylineOverlay` with blue stroke and a darker casing only if MapKit JS supports the second overlay without visual artifacts. Frame the route with `map.showItems`.

- [ ] **Step 7: Verify live behavior**

With ego-browser:

1. Search `Köln Hauptbahnhof`.
2. Select the first result.
3. Assert the Apple map center moves near `50.94335, 6.95833`.
4. Assert one selected annotation exists.
5. Open Route and assert an overlay appears after calculation.
6. Select Restaurants and assert POI annotations are clickable.

- [ ] **Step 8: Run tests and commit**

```bash
cd web
bun test src/maps/appleAnnotations.test.ts src/maps/appleRoute.test.ts
npm run build
git add web/src/maps web/src/components/AppleMapView.tsx
git commit -m "feat: complete Apple Maps web interactions"
```

---

### Task 4: Add Supported Apple Appearance Options

**Files:**
- Create: `web/src/maps/appleAppearance.ts`
- Modify: `web/src/components/AppleMapView.tsx`
- Modify: `web/src/index.css`
- Test: `web/src/maps/appleAppearance.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AppleAppearanceOptions {
  mapType: 'standard' | 'mutedStandard' | 'satellite' | 'hybrid'
  colorScheme: 'adaptive' | 'light' | 'dark'
  overlayClass: string | null
}

export function appleAppearanceOptions(
  preferences: MapPreferences,
): AppleAppearanceOptions
```

- [ ] **Step 1: Write failing mapping tests**

Verify every supported type and scheme maps to a valid MapKit JS constant. Verify `cool`, `warm`, and `reduced-color` only return overlay classes, never CSS filters for the MapKit canvas.

- [ ] **Step 2: Implement official MapKit appearance mapping**

Set:

```ts
map.mapType = mapkit.MapType.Standard
map.colorScheme = mapkit.ColorScheme.Adaptive
map.showsPointsOfInterest = true
map.tintColor = '#111111'
```

Use Standard, MutedStandard, Satellite, and Hybrid only.

- [ ] **Step 3: Add optional pointer-transparent appearance overlays**

```css
.apple-appearance-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.apple-appearance-overlay--cool {
  background: rgb(36 80 120 / 7%);
  mix-blend-mode: color;
}

.apple-appearance-overlay--warm {
  background: rgb(180 108 44 / 6%);
  mix-blend-mode: color;
}

.apple-appearance-overlay--reduced-color {
  background: rgb(128 128 128 / 12%);
  mix-blend-mode: saturation;
}
```

The overlay must remain beneath mAiity controls and above only the map surface. Do not cover Apple attribution with a separate opaque element.

- [ ] **Step 4: Verify readability**

Capture light and dark screenshots at desktop and mobile widths. Confirm labels, roads, attribution, markers, and controls remain readable.

- [ ] **Step 5: Run tests and commit**

```bash
cd web
bun test src/maps/appleAppearance.test.ts
npm run build
git add web/src/maps/appleAppearance.ts web/src/components/AppleMapView.tsx web/src/index.css
git commit -m "feat: add supported Apple map appearances"
```

---

### Task 5: Redesign Provider and Style Selection

**Files:**
- Create: `web/src/components/MapProviderPicker.tsx`
- Modify: `web/src/components/PackSwitcher.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/lib/i18n.ts`
- Modify: `web/src/index.css`
- Test: `web/test/mapProviderPicker.test.ts`

**Interfaces:**
- Consumes: `mapPreferences`, `setMapProvider`, `setAppleAppearance`, and `setCustomPack`.
- Produces: one responsive provider picker.

- [ ] **Step 1: Write a structural regression test**

Assert that:

- Apple Maps and Custom Maps are separate provider buttons;
- Apple mode exposes map type and color scheme;
- Custom mode exposes existing packs;
- 3D is absent when web Apple Maps is selected;
- all controls have accessible labels.

- [ ] **Step 2: Implement the two-level picker**

Layout:

```text
Provider
[ Apple Maps ] [ Custom Maps ]

Apple Maps selected:
Map type
[ Standard ] [ Muted ] [ Satellite ] [ Hybrid ]
Appearance
[ Adaptive ] [ Light ] [ Dark ]
Tone
[ None ] [ Cool ] [ Warm ] [ Reduced ]

Custom Maps selected:
[ Dark ] [ Neon City ] [ Los Santos ] ...
[ Create ] [ Install ]
```

Use segmented controls for provider and map type. Use small swatches for tone. Do not put Apple Maps inside the custom-pack list.

- [ ] **Step 3: Make controls capability-aware**

`App.tsx` must read renderer capabilities. Hide 3D when unsupported rather than showing a dead button. Keep location and zoom in one consistent lower-right stack.

- [ ] **Step 4: Verify responsive behavior**

Check widths `390`, `768`, `1280`, and `1920`. Text must not wrap vertically, controls must not overlap Apple’s attribution, and every touch control must remain at least 44px.

- [ ] **Step 5: Test, build, and commit**

```bash
cd web
bun test test/mapProviderPicker.test.ts
npm run build
git add web/src/components web/src/App.tsx web/src/lib/i18n.ts web/src/index.css
git commit -m "feat: separate map providers from custom styles"
```

---

### Task 6: Add Renderer Loading, Failure, and Retry States

**Files:**
- Create: `web/src/components/MapStatus.tsx`
- Modify: `web/src/components/MapView.tsx`
- Modify: `web/src/components/AppleMapView.tsx`
- Modify: `web/src/index.css`
- Test: `web/test/mapStatus.test.ts`

**Interfaces:**
- Produces:

```ts
export type RendererStatus =
  | { state: 'loading'; provider: MapProvider }
  | { state: 'ready'; provider: MapProvider }
  | { state: 'error'; provider: MapProvider; message: string }
```

- [ ] **Step 1: Write failing state tests**

Cover initial loading, successful readiness, Apple authorization failure, MapLibre style failure, retry, and explicit provider fallback.

- [ ] **Step 2: Implement a visible but restrained status surface**

Show a centered progress indicator only before the first usable frame. On failure, show:

- provider name;
- concise error;
- Retry;
- Switch Provider.

Never leave a blank white map.

- [ ] **Step 3: Replace the five-second DOM heuristic**

MapKit readiness must come from MapKit initialization/load events. MapLibre readiness must come from `load`/`style.load`. Keep a timeout only as a final network guard.

- [ ] **Step 4: Test and commit**

```bash
cd web
bun test test/mapStatus.test.ts
npm run build
git add web/src/components/MapStatus.tsx web/src/components/MapView.tsx web/src/components/AppleMapView.tsx web/src/index.css
git commit -m "feat: add map renderer loading and recovery states"
```

---

### Task 7: Lazy-Load the Selected Web Renderer

**Files:**
- Modify: `web/src/components/MapView.tsx`
- Modify: `web/src/components/AppleMapView.tsx`
- Modify: `web/vite.config.ts`
- Test: `web/test/rendererBundles.test.ts`

**Interfaces:**
- Consumes: `mapPreferences.provider`.
- Produces: independent `maplibre-renderer` and `apple-renderer` chunks.

- [ ] **Step 1: Add a bundle regression test**

Build and assert the manifest contains separate renderer chunks and that the initial app entry does not statically import `maplibre-gl`.

- [ ] **Step 2: Convert renderers to lazy imports**

```tsx
const AppleMapView = lazy(() =>
  import('./AppleMapView').then((m) => ({ default: m.AppleMapView })),
)
const MapLibreMapView = lazy(() =>
  import('./MapLibreMapView').then((m) => ({ default: m.MapLibreMapView })),
)
```

Move MapLibre-only imports and protocol registration out of the provider-neutral `MapView.tsx`.

- [ ] **Step 3: Configure stable chunk names**

Use Vite `manualChunks` only for the two renderer families. Do not manually split the rest of the application.

- [ ] **Step 4: Measure**

Record before/after:

- initial JS transfer size;
- Apple-provider first usable map time;
- Custom-provider first usable map time.

Acceptance: selecting Apple Maps does not download MapLibre until the provider changes.

- [ ] **Step 5: Build and commit**

```bash
cd web
bun test test/rendererBundles.test.ts
npm run build
git add web/src/components web/vite.config.ts web/test/rendererBundles.test.ts
git commit -m "perf: lazy-load map renderers"
```

---

### Task 8: Complete Native Apple Map Interaction and Provider UI

**Files:**
- Create: `ios/MapsApp/MapPersistence.swift`
- Create: `ios/MapsApp/MapProviderSheet.swift`
- Modify: `ios/project.yml`
- Modify: `ios/MapsApp/Models.swift`
- Modify: `ios/MapsApp/AppModel.swift`
- Modify: `ios/MapsApp/MapScreen.swift`
- Modify: `ios/MapsApp/PackPickerSheet.swift`

**Interfaces:**
- Produces:

```swift
enum MapProvider: String, Codable, CaseIterable {
    case apple
    case custom
}

enum AppleMapAppearance: String, Codable, CaseIterable {
    case standard
    case muted
    case satellite
    case hybrid
}

struct MapPreferences: Codable, Equatable {
    var version = 1
    var provider: MapProvider
    var customPackId: String
    var appleAppearance: AppleMapAppearance
}
```

- [ ] **Step 1: Add model-level persistence tests**

Create an iOS unit-test target if absent. Test defaults, legacy `light` migration, custom-pack migration, and round-trip persistence.

- [ ] **Step 2: Implement provider persistence**

Use one JSON value in `UserDefaults` under `maps.preferences.v1`. Do not scatter individual booleans across defaults.

- [ ] **Step 3: Add native map and marker selection**

Use MapKit’s selection binding:

```swift
@State private var mapSelection: String?

Map(position: $position, selection: $mapSelection) {
    Marker(place.name, coordinate: coordinate(place.lat, place.lon))
        .tag("poi:\(place.id)")
}
.onChange(of: mapSelection) { _, selection in
    guard let selection else { return }
    model.selectMapItem(selection)
}
```

Add a spatial tap gesture for unannotated map locations, reverse-geocode the coordinate, and select the resulting place. Preserve route-start-picking behavior.

- [ ] **Step 4: Map Apple appearance choices to native MapKit**

```swift
private var selectedMapStyle: MapStyle {
    switch model.mapPreferences.appleAppearance {
    case .standard: .standard(elevation: .realistic)
    case .muted: .standard(elevation: .flat, emphasis: .muted)
    case .satellite: .imagery(elevation: .realistic)
    case .hybrid: .hybrid(elevation: .realistic)
    }
}
```

Do not offer web-only tone overlays in native unless a platform-native equivalent preserves label readability.

- [ ] **Step 5: Build a native provider sheet**

The first control chooses Apple Maps or Custom Maps. Apple shows Standard, Muted, Satellite, and Hybrid. Custom shows existing packs. Keep controls at 44 points and provide VoiceOver labels and selected values.

- [ ] **Step 6: Polish native control behavior**

- Keep style, 3D, location, and zoom aligned in one trailing stack.
- Give 3D a persistent selected state.
- Apply light haptics to provider, style, 3D, and location actions.
- Disable 3D for unsupported combinations rather than ignoring taps.
- Respect reduced motion by replacing animated camera transitions with immediate region changes.

- [ ] **Step 7: Build and install**

```bash
cd ios
xcodegen generate
xcodebuild \
  -project MapsApp.xcodeproj \
  -scheme MapsApp \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  build
```

Install the signed app on the connected iPhone and manually verify:

- Apple/custom provider switching;
- map pan, pinch, rotate, zoom, location, and 3D;
- search selection;
- POI selection;
- arbitrary map tap;
- bookmarks;
- route display and navigation.

- [ ] **Step 8: Commit**

```bash
git add ios
git commit -m "feat: complete native map provider parity"
```

---

### Task 9: Persist Viewport and Improve Accessibility

**Files:**
- Create: `web/src/maps/viewportPersistence.ts`
- Modify: `web/src/components/AppleMapView.tsx`
- Modify: `web/src/components/MapLibreMapView.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/index.css`
- Modify: `ios/MapsApp/MapPersistence.swift`
- Modify: `ios/MapsApp/MapScreen.swift`
- Test: `web/src/maps/viewportPersistence.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PersistedViewport {
  version: 1
  center: { lat: number; lon: number }
  zoom: number
  bearing: number
  pitch: number
}
```

- [ ] **Step 1: Write viewport validation tests**

Reject non-finite coordinates, latitudes outside `[-90, 90]`, longitudes outside `[-180, 180]`, and stale schema versions.

- [ ] **Step 2: Persist camera changes with throttling**

Write at most once every 500ms and flush on page hide. Shared-place links and explicit search selections must override the saved viewport.

- [ ] **Step 3: Add web keyboard behavior**

- `+` and `-`: zoom;
- `Escape`: close result/provider panel;
- `/`: focus search when not typing;
- arrow-key navigation and Enter selection in search results;
- visible focus rings on every interactive control.

- [ ] **Step 4: Add an accessible list alternative**

POI/search results must remain available as a semantic list even when map markers are not keyboard-addressable. Each item focuses the corresponding map place.

- [ ] **Step 5: Complete native accessibility**

Add VoiceOver labels, hints, traits, and selected values to provider/style/3D controls. Verify Dynamic Type does not create vertical text or overlap the bottom sheet.

- [ ] **Step 6: Test and commit**

```bash
cd web
bun test src/maps/viewportPersistence.test.ts
npm run build
git add web ios
git commit -m "feat: persist map viewport and improve accessibility"
```

---

### Task 10: End-to-End Verification, Deployment, and CodeGraph

**Files:**
- Modify: `docs/map-provider-behavior.md`
- Regenerate: `graphify-out/*`

**Interfaces:**
- Consumes all previous tasks.
- Produces a deployed, documented, and graph-indexed release.

- [ ] **Step 1: Run all web tests**

```bash
cd web
bun test src test
npm run build
```

Expected: all tests pass and production build succeeds.

- [ ] **Step 2: Run the iOS build**

```bash
cd ios
xcodegen generate
xcodebuild \
  -project MapsApp.xcodeproj \
  -scheme MapsApp \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Run the provider parity matrix**

Verify each row on web and native:

| Behavior | Apple | Custom |
|---|---:|---:|
| First map frame | ✓ | ✓ |
| Pan/zoom/rotate | ✓ | ✓ |
| Location | ✓ | ✓ |
| Search camera and marker | ✓ | ✓ |
| Map-tap selection | ✓ | ✓ |
| POI selection | ✓ | ✓ |
| Bookmark markers | ✓ | ✓ |
| Route line and framing | ✓ | ✓ |
| Provider/style persistence | ✓ | ✓ |
| Viewport persistence | ✓ | ✓ |
| Loading/error/retry | ✓ | ✓ |
| Keyboard/VoiceOver | ✓ | ✓ |

- [ ] **Step 4: Run visual checks**

Use ego-browser screenshots at:

- `390 × 844`
- `768 × 1024`
- `1280 × 800`
- `1920 × 1080`

Check expanded/collapsed sidebar, search results, place card, route panel, provider picker, Apple light/dark/satellite/hybrid, and every custom pack. Verify no overlap, vertical text, blank map, or inaccessible contrast.

- [ ] **Step 5: Deploy web and API only when changed**

```bash
cd /Users/enrico/Documents/GitHub/maps
./deploy/deploy.sh web
```

If server code changed:

```bash
./deploy/deploy.sh api
```

Verify:

```bash
curl -fsS https://maps.aiity.de/maps/api/healthz
curl -fsSI https://maps.aiity.de/maps/ | sed -n '1p'
```

- [ ] **Step 6: Install the signed native build**

Install to the connected iPhone, launch it, and repeat the native rows in the parity matrix.

- [ ] **Step 7: Refresh CodeGraph**

Run:

```bash
cd /Users/enrico/Documents/GitHub/maps
graphify update . --force
test -s graphify-out/graph.json
python3 -m json.tool graphify-out/graph.json >/dev/null
```

Verify `graphify-out` is regenerated and commit only deterministic graph changes.

- [ ] **Step 8: Final commit and push**

```bash
git add docs graphify-out
git commit -m "docs: record map provider behavior"
git push origin main
```

- [ ] **Step 9: Production smoke test**

On `https://maps.aiity.de/maps/`:

1. Open Apple Maps without login.
2. Pan and zoom.
3. Search and select a place.
4. Start a route.
5. Switch to Custom Maps.
6. Confirm route/selection state remains coherent.
7. Reload and confirm provider, style, sidebar, and viewport persist.

Expected: no 401 refresh loop, blank surface, dead control, missing marker, or provider-specific state loss.

---

## Explicit Non-Goals

- Recoloring Apple’s underlying vector roads, water, labels, buildings, or terrain.
- CSS filtering the MapKit canvas.
- Replacing Apple map content with opaque custom tiles while still calling it Apple Maps.
- Adding Android in this implementation.
- Building offline Apple Maps downloads.
- Replacing the current geocoder or routing backend.

## Success Criteria

- Apple Maps is a complete renderer, not merely a visible tile surface.
- Search selection moves and annotates both renderers.
- Routes, POIs, bookmarks, location, and map taps work on web and native.
- Provider selection and visual style selection are no longer conflated.
- Apple appearance options remain within supported MapKit behavior.
- Unsupported controls are hidden or disabled with a clear reason.
- First load downloads only the selected web renderer.
- No blank-map failures; every failure has Retry and Switch Provider actions.
- The last provider, appearance, custom pack, sidebar state, and viewport survive reload.
- All automated tests, production builds, device checks, and live smoke tests pass.
