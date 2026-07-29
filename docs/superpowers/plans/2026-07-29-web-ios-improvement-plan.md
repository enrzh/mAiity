# mAiity — Web + Native Improvement Plan

> **For agentic workers:** implement phase by phase. Each task uses checkbox (`- [ ]`) tracking. Leave web build + bun tests green after every web task; leave Xcode build green after every iOS task. Prefer small vertical slices over big-bang refactors.

**Goal:** Close web ↔ iOS parity gaps so race mode, navigation, map providers, search, and polish feel like **one product** on both clients — map-first, provider-agnostic, playable race on phone and desktop.

**Date:** 2026-07-29  
**Baseline:** `main` @ `f034a4c` (race harden pass)  
**Related:**
- `docs/superpowers/plans/2026-07-29-racing-mode-vision.md` (phases A–D shipped; E open)
- `docs/superpowers/plans/2026-07-29-map-provider-parity.md`
- `docs/superpowers/plans/2026-07-29-driving-game-mode.md`
- `PRODUCT.md`

---

## Product principles (do not violate)

1. Map stays the primary surface — chrome never traps core actions.
2. One UI surface at a time (packs / saved / route / race / search results).
3. Apple Maps is a **provider**, not a MapLibre skin.
4. Race is **car routes only**.
5. Platform-native feel (SwiftUI patterns on iOS; web rail + mobile sheet on web).
6. Accessibility: WCAG AA / keyboard on web; Dynamic Type, VO, 44pt, safe area, reduced motion on iOS.

---

## Current state snapshot

| Domain | Web | iOS | Winner |
|--------|-----|-----|--------|
| Race physics (throttle/brake/steer) | ✅ Game loop | ❌ Auto timer only | **Web** |
| Race HUD as map overlay | ✅ | ❌ Sheet-only | **Web** |
| Chase cam (Apple + custom) | ✅ | ✅ | Tie |
| Lateral / lane offset on car | ✅ | ❌ | **Web** |
| Run history storage | ✅ (no UI) | ✅ (no UI) | Tie (both missing UI) |
| Turn-by-turn follow cam | MapLibre only | Both providers | **iOS** |
| Search this area | MapLibre-biased | Missing | **Web (partial)** |
| Provider prefs model | Versioned `v1` | Legacy split keys | **Web** |
| Pack install | ✅ + PackEditor | Install only | **Web** |
| Empty-map reverse-geocode | Both providers | Custom only | **Web** |
| Zoom controls | Shared stack | Apple yes / custom no | **Web** |
| Phase E polish | Open | Open | Neither |

---

## Success metrics (end of plan)

- [ ] iOS race is **playable** with touch pads (not autoplay-only) on Apple + custom.
- [ ] Web turn-by-turn + “search this area” work when provider is **Apple**.
- [ ] Provider/style/viewport survive cold start on both platforms.
- [ ] Finished race runs show a **history list** on both platforms.
- [ ] Race strings localized (iOS all langs; web via i18n keys).
- [ ] Automated web tests green; native build installable; production smoke on `maps.aiity.de` + device.

---

## Out of scope (unless re-prioritized)

- Multiplayer / social races
- Full physics engine (Box2D etc.)
- Photoreal street-view panoramas
- Android client
- Server-side run leaderboards

---

# Phase overview (4–6 weeks)

| Phase | Weeks | Theme | Priority |
|-------|-------|--------|----------|
| **1** | 1–2 | Race parity (iOS) + critical web Apple nav | **P0** |
| **2** | 2–3 | Provider & interaction parity | **P0 / P1** |
| **3** | 3–4 | Persistence UX, run history, a11y | **P1** |
| **4** | 4–5 | Phase E lite polish | **P2** |
| **5** | 5–6 | Hardening, perf, deploy | Buffer |

---

# Phase 1 — Race parity + critical navigation (P0)

**Exit criteria:** iOS race playable with controls; web TBT + search-this-area work on Apple Maps.

## Task 1.1 — iOS driving physics (port web game model)

**Files:**
- Create: `ios/MapsApp/DrivingPhysics.swift` (mirror `web/src/lib/drivingGame.ts`)
- Create: `ios/MapsApp/DrivingSession.swift` (or extend enum in `AppModel` with `speedMps`, `lateral`)
- Modify: `ios/MapsApp/AppModel.swift` — replace pure `elapsed/duration` loop with input-driven step
- Modify: `ios/MapsApp/Navigation.swift` — shared `pointAtProgress` / bearing if not already sufficient
- Test: unit tests if target exists; otherwise manual matrix

**Interfaces:**

```swift
struct DrivingInput { var throttle: Bool; var brake: Bool; var steer: Double } // -1…1
struct DrivingPhysicsState { var progress: Double; var speedMps: Double; var lateral: Double }
func stepDriving(state: DrivingPhysicsState, input: DrivingInput, dt: TimeInterval, distanceM: Double) -> DrivingPhysicsState
```

- [ ] Port acceleration / brake / coast constants from web (`+10`, `-14`, `-3`, cap 55 m/s)
- [ ] Keep pause/finish **physics-safe** (do not recompute progress from wall clock)
- [ ] `resetDriving()` re-arms ready without clearing route
- [ ] Persist finished runs via existing `DrivingRunStore`

**Acceptance:** On a car route, holding throttle advances progress; releasing coasts to stop; pause freezes position; finish saves run; Apple + custom chase cam still follow.

## Task 1.2 — iOS race map-overlay HUD + touch pads

**Files:**
- Create: `ios/MapsApp/RaceHUDView.swift`
- Modify: `ios/MapsApp/MapsApp.swift` / `RootView` — overlay above map, below safe areas
- Modify: `ios/MapsApp/SheetView.swift` — collapse sheet during running/paused/finished; keep short entry buttons on route
- Modify: `ios/MapsApp/Localization.swift` — race keys (all languages)

**HUD contents (match web):**
- Timer, speed km/h, progress bar
- Start / Pause / Resume / Finish / Race again
- Touch pads: left / brake / go / right (≥44pt, `pointer`-style hold)

- [ ] Starting race collapses sheet to minimal detent and closes pack picker
- [ ] HUD remains visible when sheet is collapsed
- [ ] All strings via `L.t(...)` (no hardcoded English)

**Acceptance:** Race playable without keyboard; sheet cannot bury Start/Pause; VoiceOver labels on pads.

## Task 1.3 — iOS car lateral + start-line visibility

**Files:**
- Modify: `ios/MapsApp/MapScreen.swift` — car annotation uses lateral offset; show for ready…finished
- Modify: `ios/MapsApp/CustomMapScreen.swift` — same for driving source
- Modify: `ios/MapsApp/AppModel.swift` — publish lateral with camera if needed

- [ ] Lateral ± lane meters (~3.2 m) from steering input
- [ ] Car visible at progress 0 (ready) and 1 (finished)

**Acceptance:** Steering visibly moves car off centerline; car not missing at start.

## Task 1.4 — Web: turn-by-turn on Apple Maps

**Files:**
- Modify: `web/src/maps/rendererController.ts` — ensure camera/follow commands are provider-neutral
- Modify: `web/src/components/AppleMapView.tsx` — implement follow cam + user annotation for navigation
- Modify: `web/src/components/NavigationPanel.tsx` — stop depending only on MapLibre `liveMap`
- Modify: `web/src/components/MapView.tsx` — register Apple adapter capabilities (`threeD` / follow as supported)

- [ ] `activeMapViewport()` returns Apple center/zoom when Apple active
- [ ] Nav start moves Apple camera with heading; user position updates
- [ ] Off-route + reroute still work

**Acceptance:** Provider = Apple → Start navigation → camera follows GPS; step text updates; works after provider switch mid-session (or restarts cleanly).

## Task 1.5 — Web: “Search this area” + viewport for both providers

**Files:**
- Modify: `web/src/components/SearchAreaButton.tsx` — use `activeMapViewport()` only
- Modify: `web/src/components/MapView.tsx` — write custom MapLibre viewport to `viewportStorage` (today Apple-only)
- Modify: `web/src/maps/viewportStorage.ts` if API needs bounds

- [ ] Custom provider persists last viewport
- [ ] Search-this-area uses current bounds on Apple and custom

**Acceptance:** Pan with category active → button appears → POIs refresh for visible bounds on both providers.

**Phase 1 commit style:**  
`feat(ios): playable race physics and overlay HUD`  
`fix(web): Apple Maps navigation follow cam and search-area bounds`

---

# Phase 2 — Provider & interaction parity (P0/P1)

**Exit criteria:** Provider preference matrix green; empty-map tap and zoom stack match across native screens.

## Task 2.1 — iOS unified map preferences

**Files:**
- Create: `ios/MapsApp/MapPersistence.swift` (mirror `providerPreferences.ts`)
- Modify: `ios/MapsApp/AppModel.swift` — single prefs blob; migrate `maps.activePack`, type, scheme
- Modify: `ios/MapsApp/PackPickerSheet.swift` — explicit Apple vs Custom (not `light` magic alone)
- Optional create: `ios/MapsApp/MapProviderSheet.swift`

```swift
struct MapPreferences: Codable {
  var version: Int // 1
  var provider: String // "apple" | "custom"
  var customPackId: String
  var appleMapType: String
  var appleColorScheme: String
}
```

- [ ] Migrate legacy keys once
- [ ] Round-trip provider + pack + Apple type/scheme
- [ ] Add muted map type if MapKit SwiftUI supports it

**Acceptance:** Kill app → relaunch restores provider/style; switching light pack no longer required to “mean Apple”.

## Task 2.2 — iOS Apple empty-map reverse-geocode

**Files:**
- Modify: `ios/MapsApp/MapScreen.swift` — onTap empty map → `AppModel` reverse geocode / pick-start
- Align behavior with `CustomMapScreen` tap gesture

**Acceptance:** Tap empty Apple map selects place; route “change start” pick works.

## Task 2.3 — iOS custom map zoom controls

**Files:**
- Modify: `ios/MapsApp/CustomMapScreen.swift` — +/− matching Apple stack (44pt, above sheet)

**Acceptance:** Zoom stack order and position match Apple screen.

## Task 2.4 — iOS “Search this area”

**Files:**
- Modify: `ios/MapsApp/SheetView.swift` or map overlay button
- Modify: `ios/MapsApp/AppModel.swift` — `showCategory` with visible region bounds from active map

**Acceptance:** Category active + pan → re-query nearby in bounds (Apple + custom).

## Task 2.5 — Web map status / error surface

**Files:**
- Create: `web/src/components/MapStatus.tsx` (or inline equivalent)
- Modify: `web/src/components/AppleMapView.tsx`, `MapView.tsx`, `App.tsx`

- [ ] MapKit token failure → Retry + Switch to custom
- [ ] Style load failure → Retry + message (not blank canvas)

**Acceptance:** No silent blank map; user always has recovery path.

**Phase 2 commits:**  
`feat(ios): unified map preferences and interaction parity`  
`feat(web): map status and recovery UI`

---

# Phase 3 — Persistence UX, history, accessibility (P1)

**Exit criteria:** Run history visible; viewport on iOS; a11y smoke pass.

## Task 3.1 — Run history UI (both)

**Files:**
- Web: `web/src/components/DrivingModePanel.tsx` (+ optional `DrivingRunsList.tsx`)
- iOS: `RaceHUDView.swift` / `SheetView.swift`
- Both already store ≤20 runs

**UI:** date · duration · distance · avg km/h · empty state

- [ ] Show after finish and from ready state (collapsible “Recent runs”)
- [ ] Cap display at 20; oldest dropped already by store

**Acceptance:** Complete two races → both appear after relaunch.

## Task 3.2 — iOS viewport persistence

**Files:**
- `MapPersistence.swift` + `MapScreen.swift` + `CustomMapScreen.swift`
- Restore on launch; override when search/select fires

**Acceptance:** Cold start opens last camera (± tolerance); selecting a place still flies to it.

## Task 3.3 — Web keyboard shortcuts

**Files:**
- `web/src/App.tsx`, `SearchBar.tsx`

| Key | Action |
|-----|--------|
| `/` | Focus search (when not in input) |
| `+` / `-` | Zoom |
| `Esc` | Close packs/saved / cancel pick |

**Acceptance:** Shortcuts work; ignored while typing in inputs.

## Task 3.4 — Accessibility hardening

**Files:**
- Web: race pads labels, focus rings, reduced motion already partial
- iOS: `Localization.swift` race keys all langs; reduced-motion for chase cam; VO structure on HUD

- [ ] No race string hardcoding
- [ ] Reduced motion → jump camera, no required decorative animation
- [ ] Touch targets ≥ 44pt / 44px

**Acceptance:** VoiceOver / screen reader can start, drive (pads), pause, finish; reduced motion does not break race.

**Phase 3 commits:**  
`feat: race run history UI on web and iOS`  
`feat: viewport persistence and a11y race polish`

---

# Phase 4 — Phase E lite polish (P2)

**Exit criteria:** Vision Phase E partially closed (no multiplayer).

## Task 4.1 — Countdown 3-2-1 before start

**Files:**
- Web session status: add `countdown` or UI-only overlay before `running`
- iOS: same in HUD

**Acceptance:** Start shows 3–2–1 then enables input; Esc/cancel aborts to ready.

## Task 4.2 — Haptics (iOS)

**Files:**
- `AppModel` / `RaceHUDView` — light impact on start, success on finish, soft on pause

**Acceptance:** Haptics fire when system allows; no crash when disabled.

## Task 4.3 — Better car presentation

**Files:**
- Web: upgrade CSS car (`index.css`, MapView marker); optional simple SVG
- iOS: create `DrivingCarView.swift` (shape, not only SF Symbol); use on both map screens

**Acceptance:** Car readable at street zoom; still works reduced motion / dark packs.

## Task 4.4 — Optional minimap

**Files:**
- New web component + iOS overlay: route polyline + car dot + heading

**Acceptance:** Minimap updates with progress; hideable; does not block touch pads.

**Phase 4 commits:**  
`feat: race countdown, haptics, car polish, optional minimap`

---

# Phase 5 — Hardening, perf, deploy (buffer)

## Task 5.1 — Lazy-load map engines (web)

**Files:**
- Split `MapLibreMapView` if still in critical path with Apple
- `vite.config.ts` manualChunks if measured win

**Acceptance:** First paint with Apple preference does not download MapLibre (or significantly smaller).

## Task 5.2 — DEM / terrain decision

**Files:**
- `web/src/components/MapView.tsx` (`TERRAIN_ENABLED = false` today)
- `server/src/dem.ts`

**Options:** (a) fix decode + re-enable with fallback, or (b) remove dead path and document “pitch-only 3D”.

**Acceptance:** No blank map; documented behavior.

## Task 5.3 — Pack create on iOS (optional)

- Port minimal PackEditor **or** document “create on web only” in UI copy.

## Task 5.4 — Full matrix + ship

| Check | Web | iOS |
|-------|-----|-----|
| Apple provider: search, POI, bookmark, route, nav | ☐ | ☐ |
| Custom pack: same + 3D buildings at race zoom | ☐ | ☐ |
| Race full loop + history | ☐ | ☐ |
| Packs/route exclusivity | ☐ | ☐ |
| Auth email + Apple | ☐ | ☐ |
| Reduced motion / VO smoke | ☐ | ☐ |

- [ ] `bun test` + web build
- [ ] Xcode build + install on device
- [ ] `./deploy/deploy.sh web` (and API if needed)
- [ ] Smoke `https://maps.aiity.de/maps/`
- [ ] Refresh CodeGraph (`graphify update . --force`) if used

---

# Priority backlog (quick reference)

## Shared P0
1. iOS race physics + overlay HUD + lateral car  
2. Web Apple TBT follow cam  
3. Search-this-area bounds on both providers (web complete; iOS add)

## Shared P1
4. Run history UI  
5. iOS prefs v1 + viewport persistence  
6. iOS empty-map tap + custom zoom  
7. Localize race + a11y / reduced motion  

## Shared P2
8. Countdown, haptics, car upgrade, minimap  
9. GPS-assisted race (optional later)  
10. Multiplayer (out of scope)

## Web-only P1/P2
- MapStatus recovery UI  
- Keyboard shortcuts  
- Lazy renderer chunks  
- Terrain re-enable or delete  

## iOS-only P1/P2
- MapProviderSheet / MapPersistence cleanup  
- Continuous location stream vs 2s poll for nav  
- Pack create (optional)  

---

# Suggested implementation order (first two weeks)

```
Week 1
  Mon–Tue  Task 1.1 iOS physics
  Wed      Task 1.2 iOS HUD overlay
  Thu      Task 1.3 lateral + start-line car
  Fri      Device QA + fix regressions

Week 2
  Mon–Tue  Task 1.4 web Apple TBT
  Wed      Task 1.5 search-area + viewport write
  Thu      Task 2.3 custom zoom + 2.2 empty tap (start)
  Fri      Deploy web; install iOS; matrix smoke
```

---

# Test matrix (race)

| Step | Web custom | Web Apple | iOS custom | iOS Apple |
|------|------------|-----------|------------|-----------|
| Car route → ready HUD | | | | |
| Start → chase cam pitch | | | | |
| Throttle advances | | | | |
| Steer moves car | | | | |
| Pause freezes progress | | | | |
| Finish saves run | | | | |
| Race again resets | | | | |
| Open packs mid-route shows list | | | | |
| Bike route does **not** arm race | | | | |

---

# File ownership map

| Area | Web | iOS |
|------|-----|-----|
| Race session/physics | `lib/driving*.ts`, `state.tsx` | `DrivingPhysics.swift`, `AppModel.swift` |
| Race HUD | `DrivingModePanel.tsx`, `App.tsx` | `RaceHUDView.swift`, `SheetView.swift` |
| Car on map | `MapView.tsx`, `AppleMapView.tsx`, `index.css` | `MapScreen.swift`, `CustomMapScreen.swift`, `DrivingCarView.swift` |
| Nav TBT | `NavigationPanel.tsx`, `lib/navigation.ts` | `AppModel.swift`, `Navigation.swift` |
| Providers | `maps/providerPreferences.ts`, `PackSwitcher.tsx` | `MapPersistence.swift`, `PackPickerSheet.swift` |
| Viewport | `maps/viewportStorage.ts` | `MapPersistence.swift` |
| i18n | `lib/i18n.ts` | `Localization.swift` |

---

# Definition of done (whole plan)

1. All Phase 1–3 checkboxes complete; Phase 4 as time allows.  
2. Web: 24+ unit tests still green; production build ships.  
3. iOS: signed build on device; race + nav matrix green.  
4. Vision doc Phase E updated with what shipped vs deferred.  
5. PRODUCT principles still held (map-first, one surface, provider honesty).

---

## Next action

Start **Phase 1 Task 1.1** (iOS driving physics port) — highest user-visible gap vs web race feel — or **Task 1.4** (web Apple TBT) if device build capacity is blocked.

When implementing, open a PR/commit per task, not one megacommit for the whole plan.
