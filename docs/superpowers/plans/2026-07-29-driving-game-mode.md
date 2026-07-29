# Driving Game Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a route-based driving time-trial mode to the web and native map apps, with a virtual car, start/pause/finish controls, timing, progress, and saved run results.

**Architecture:** Reuse the existing route geometry and navigation math. A small platform-neutral playback model advances a car along route coordinates using elapsed time, while the existing map renderers display the car and progress. Native additionally offers an explicit GPS mode; web remains automatic playback. Run results are stored locally and are never sent to the route API.

**Tech Stack:** React 19 + TypeScript + Vite, SwiftUI + MapKit/MapLibre, Bun tests, existing route API and navigation utilities.

## Global Constraints

- Keep ordinary navigation unchanged.
- Driving mode requires a ready car route with at least two geometry points.
- Automatic playback is the default; native GPS mode is opt-in.
- Use `requestAnimationFrame` on web and a cancellable Swift timer/task on native.
- Do not add a new map provider, route service, or game engine dependency.
- Respect reduced-motion preferences and provide visible controls for every gesture.
- Store only completed run summaries locally: route endpoints, mode, duration, distance, average speed, and timestamp.

### Task 1: Shared playback math

**Files:**
- Create: `web/src/lib/driving.ts`
- Test: `web/src/lib/driving.test.ts`
- Modify: `ios/MapsApp/Navigation.swift`
- Test: `ios/MapsApp/NavigationTests.swift` if the existing test target supports it

**Interfaces:**
- `pointAtProgress(geometry, progress)` returns the interpolated `[lon, lat]` point and bearing.
- `distanceAlongGeometry(geometry)` returns meters.
- `progressForElapsed(elapsed, duration)` clamps to `0...1`.
- Swift exposes equivalent `Driving.point(at:progress:)` and `Driving.distance(of:)` helpers.

- [ ] Write failing tests for interpolation, bearing, distance, elapsed clamping, and degenerate geometry.
- [ ] Run the focused tests and confirm they fail for missing helpers.
- [ ] Implement the smallest geometry helpers using existing navigation distance/bearing functions.
- [ ] Run web and native focused tests and confirm they pass.
- [ ] Commit with `feat: add shared driving playback math`.

### Task 2: Web driving session state

**Files:**
- Create: `web/src/lib/drivingSession.ts`
- Test: `web/src/lib/drivingSession.test.ts`
- Modify: `web/src/state.tsx`

**Interfaces:**
- `DrivingSession` contains `status: 'idle'|'ready'|'running'|'paused'|'finished'`, `startedAt`, `elapsedMs`, `durationMs`, `progress`, `distanceM`, `mode: 'automatic'`.
- `createDrivingSession(route)` creates a ready session using a duration based on route distance and a capped default speed.
- `startDriving`, `pauseDriving`, `resumeDriving`, `finishDriving` are pure transitions.
- `saveDrivingRun` and `loadDrivingRuns` use a versioned local-storage key and tolerate malformed data.

- [ ] Write failing transition and persistence tests.
- [ ] Verify the tests fail.
- [ ] Implement pure state transitions and versioned persistence.
- [ ] Add session state to `AppState` without changing existing route behavior.
- [ ] Run focused tests and confirm pass.
- [ ] Commit with `feat: add web driving session state`.

### Task 3: Web car renderer and controls

**Files:**
- Create: `web/src/components/DrivingModePanel.tsx`
- Create: `web/src/components/DrivingCarOverlay.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/MapView.tsx`
- Modify: `web/src/components/AppleMapView.tsx`
- Modify: `web/src/index.css`

**Interfaces:**
- `DrivingCarOverlay` receives the current route geometry and session snapshot and renders one accessible car marker plus route progress.
- `DrivingModePanel` provides `Start`, `Pause`, `Resume`, `Finish`, speed/duration summary, and a completed result state.

- [ ] Add component tests for disabled state without a route, start/pause/finish labels, and finished summary.
- [ ] Implement the panel as a compact bottom control surface with one primary action and tabular timer figures.
- [ ] Drive playback with `requestAnimationFrame`, updating only transforms/marker position and respecting `prefers-reduced-motion`.
- [ ] Add the car overlay to both MapLibre and Apple web renderers through the existing renderer controller.
- [ ] Fit the camera to the route on start and follow the car only while the session is running.
- [ ] Run web tests and build.
- [ ] Commit with `feat: add web driving time trials`.

### Task 4: Native driving mode

**Files:**
- Modify: `ios/MapsApp/AppModel.swift`
- Modify: `ios/MapsApp/MapScreen.swift`
- Modify: `ios/MapsApp/CustomMapScreen.swift`
- Modify: `ios/MapsApp/SheetView.swift`
- Create: `ios/MapsApp/DrivingCarView.swift`
- Create: `ios/MapsApp/DrivingRunStore.swift`

**Interfaces:**
- `AppModel.drivingSession` mirrors the web session states.
- `AppModel.startDriving(automatic:)`, `pauseDriving()`, `resumeDriving()`, `finishDriving()` control the mode.
- `DrivingRunStore` persists versioned completed summaries with `UserDefaults`.

- [ ] Add native tests for playback interpolation and finish summary where the project test target permits.
- [ ] Add a route-section control to enter driving mode, defaulting to automatic playback.
- [ ] Render a car annotation/overlay in both MapKit and MapLibre screens with platform-native accessibility labels.
- [ ] Add a clearly labeled optional `GPS mode`; it uses the existing location/off-route state and never starts automatically.
- [ ] Stop timers/tasks on pause, finish, route clear, and view disappearance.
- [ ] Build the signed app and verify controls on the connected iPhone.
- [ ] Commit with `feat: add native driving mode`.

### Task 5: Run history and polish

**Files:**
- Modify: `web/src/components/DrivingModePanel.tsx`
- Modify: `ios/MapsApp/SheetView.swift`
- Modify: `web/src/index.css`
- Modify: `ios/MapsApp/Localization.swift`

- [ ] Add a small recent-runs list showing date, duration, distance, and average speed.
- [ ] Add empty, loading, paused, finished, and no-route states.
- [ ] Verify touch targets are at least 44px/44pt, timer numerals are tabular, and controls remain above safe-area insets.
- [ ] Add reduced-motion handling and ensure no decorative animation is required to understand state.
- [ ] Run all web tests, web build, native build, and `git diff --check`.
- [ ] Commit with `feat: polish driving mode history and accessibility`.

### Task 6: Deploy and verify

**Files:**
- Modify: `deploy/deploy.sh` only if the new web assets need a deployment guard.
- Refresh: `graphify-out/` using `graphify update . --force`.

- [ ] Deploy web with `./deploy/deploy.sh web`.
- [ ] Verify `https://maps.aiity.de/maps/` returns 200 and PMTiles range requests return 206.
- [ ] Build and install the signed native app on the connected iPhone.
- [ ] Verify a route can enter driving mode, start, pause, resume, finish, and display a saved result on both platforms.
- [ ] Refresh CodeGraph after final edits.
- [ ] Commit any graph/deploy updates and push `main`.
