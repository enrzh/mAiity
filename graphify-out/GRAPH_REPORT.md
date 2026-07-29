# Graph Report - maps  (2026-07-29)

## Corpus Check
- 147 files · ~110,366 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1113 nodes · 2298 edges · 77 communities (57 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e46e9a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.ts
- AppModel
- state.tsx
- APIClient
- make_pack_textures.swift
- App.tsx
- PackSwitcher.tsx
- Models.swift
- PlaceCard.tsx
- PoiIndex
- components.json
- cn
- package.json
- compilerOptions
- LocationService
- Nav
- dependencies
- compilerOptions
- SheetView
- devDependencies
- PackSwitcher.tsx
- AuthSheet
- View
- maps — web + native map with swappable texture packs
- package.json
- route-packs.test.ts
- CustomMapScreen
- rendererController.ts
- dl-planet.sh
- clsx
- build-poi-db.sh
- build-pois.sh
- build-tiles.sh
- deploy.sh
- @fontsource-variable/geist
- NavigationPanel.tsx
- next-themes
- pmtiles
- react
- build-poi-db.sh
- sonner
- tailwindcss
- @tailwindcss/vite
- tw-animate-css
- AppleMapsClient
- createApp
- i18n.ts
- Apple Web Login Design
- MapScreen
- CustomMapScreen
- driving.ts
- RaceHUDView
- AppleMapView.tsx
- Global Constraints
- userpacks.ts
- lucide-react
- auth.test.ts
- sidebarState.ts
- 2026-07-29-map-controls-and-layout-plan.md
- drivingCamera.ts
- AppModel.swift
- String
- rendererController.ts
- .requestRoute
- mAiity — Project Master Plan (web + native)
- viewportStorage.ts
- RaceHUDView
- Global Constraints
- mAiity racing mode — product vision (v2)
- SwiftUI
- Double
- MapTokens
- .pick
- lucide-react
- @tailwindcss/vite

## God Nodes (most connected - your core abstractions)
1. `AppModel` - 91 edges
2. `cn()` - 70 edges
3. `useApp()` - 43 edges
4. `useT()` - 36 edges
5. `APIClient` - 27 edges
6. `createApp()` - 22 edges
7. `MapLibreMapView()` - 20 edges
8. `AppProvider()` - 20 edges
9. `Button()` - 19 edges
10. `AppleMapView()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `registerGeocodeRoutes()` --indirect_call--> `key()`  [INFERRED]
  server/src/geocode.ts → web/src/maps/viewportStorage.ts
- `registerRouteRoutes()` --indirect_call--> `key()`  [INFERRED]
  server/src/route.ts → web/src/maps/viewportStorage.ts
- `storageFrom()` --indirect_call--> `key()`  [INFERRED]
  web/src/maps/providerPreferences.test.ts → web/src/maps/viewportStorage.ts
- `makeApp()` --calls--> `createApp()`  [EXTRACTED]
  server/test/route-packs.test.ts → server/src/server.ts
- `makeApp()` --calls--> `createApp()`  [EXTRACTED]
  server/test/social.test.ts → server/src/server.ts

## Import Cycles
- 3-file cycle: `web/src/maps/providerPreferences.ts -> web/src/maps/types.ts -> web/src/state.tsx -> web/src/maps/providerPreferences.ts`

## Communities (77 total, 20 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.15
Nodes (13): AppOpts, appleJWKS, AppleWebOAuth, googleJWKS, makeSocialVerifier(), now(), registerSocialRoutes(), SessionIssuer (+5 more)

### Community 1 - "AppModel"
Cohesion: 0.13
Nodes (11): AppModel, RouteUI, Int, Never, Pack, RouteMode, RouteResult, Task (+3 more)

### Community 2 - "state.tsx"
Cohesion: 0.09
Nodes (22): CheckedContinuation, CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate, CustomMapScreen, CGFloat, CLLocationCoordinate2D (+14 more)

### Community 3 - "APIClient"
Cohesion: 0.11
Nodes (21): Data, Encodable, Error, APIClient, APIError, Bookmark, Bool, Double (+13 more)

### Community 4 - "make_pack_textures.swift"
Cohesion: 0.08
Nodes (35): CoreGraphics, Foundation, ImageIO, rgb(), CGColor, CGFloat, UInt32, blockFace() (+27 more)

### Community 5 - "App.tsx"
Cohesion: 0.13
Nodes (32): Detent, DETENTS, EmptyRail(), LANGS, LanguageMenu(), MapControls(), Panel, RailControls() (+24 more)

### Community 6 - "PackSwitcher.tsx"
Cohesion: 0.19
Nodes (10): fmtDist(), fmtDur(), RoutePanel(), Badge(), badgeVariants, Button(), buttonVariants, Separator() (+2 more)

### Community 7 - "Models.swift"
Cohesion: 0.11
Nodes (33): Codable, Equatable, Identifiable, MKCoordinateRegion, MapPersistence, MapPreferences, SavedViewport, Double (+25 more)

### Community 8 - "PlaceCard.tsx"
Cohesion: 0.07
Nodes (55): authed(), Bookmark, GeoResult, Pack, parseError(), PlaceDetails, refreshSession(), RouteMode (+47 more)

### Community 9 - "PoiIndex"
Cohesion: 0.11
Nodes (15): GeoResult, NEARBY_CATEGORIES, nextSlot, normalize(), PLACE_RANK, registerGeocodeRoutes(), degBox(), DETAIL_COLUMNS (+7 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "cn"
Cohesion: 0.08
Nodes (30): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), DialogFooter() (+22 more)

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): fastify, @fastify/cookie, @fastify/cors, jose, dependencies, fastify, @fastify/cookie, @fastify/cors (+9 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, DOM.Iterable, ES2022, src/**/*.test.ts, compilerOptions, baseUrl, isolatedModules, jsx (+11 more)

### Community 14 - "LocationService"
Cohesion: 0.18
Nodes (10): de, DICTS, en, es, fr, it, makeT(), nl (+2 more)

### Community 15 - "Nav"
Cohesion: 0.26
Nodes (7): Element, Array, Nav, Snapped, Double, Int, RouteStep

### Community 16 - "dependencies"
Cohesion: 0.15
Nodes (13): class-variance-authority, clsx, radix-ui, react-dom, shadcn, tailwind-merge, dependencies, class-variance-authority (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.17
Nodes (11): bun-types, test, compilerOptions, module, moduleResolution, noEmit, strict, target (+3 more)

### Community 18 - "SheetView"
Cohesion: 0.27
Nodes (8): AuthenticationServices, CaseIterable, AppConfig, AuthSheet, Mode, login, register, String

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, devDependencies, @types/react, @types/react-dom (+3 more)

### Community 20 - "PackSwitcher.tsx"
Cohesion: 0.14
Nodes (20): ERROR_KEY, applySlots(), DEFAULTS, luminance(), shade(), SLOT_LABELS, Slots, Dialog() (+12 more)

### Community 22 - "View"
Cohesion: 0.04
Nodes (44): Current state snapshot, Definition of done (whole plan), File ownership map, iOS-only P1/P2, mAiity — Web + Native Improvement Plan, Next action, Out of scope (unless re-prioritized), Phase 1 — Race parity + critical navigation (P0) (+36 more)

### Community 23 - "maps — web + native map with swappable texture packs"
Cohesion: 0.22
Nodes (8): Add rich POIs (Overture + Foursquare), iOS, Layout, Make it *your* map (self-hosted tiles), maps — web + native map with swappable texture packs, Notes / gotchas, Roadmap, Run the web client

### Community 24 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 25 - "route-packs.test.ts"
Cohesion: 0.17
Nodes (11): COSTINGS, decodePolyline6(), normalize(), now(), registerRouteRoutes(), RouteResult, RouteStep, App (+3 more)

### Community 26 - "CustomMapScreen"
Cohesion: 0.52
Nodes (5): detentPx(), Shell(), readSidebarCollapsed(), StorageLike, writeSidebarCollapsed()

### Community 27 - "rendererController.ts"
Cohesion: 0.14
Nodes (17): locateUser(), set3D(), zoomBy(), AppleMapView, locateUser(), MapLibreMapView, MapView(), set3D() (+9 more)

### Community 29 - "clsx"
Cohesion: 0.22
Nodes (8): Apple Authentication, Architecture, Goal, mAiity Map Controls and Layout Design, Native Map Controls, Testing, Web Layout, Web Map Controls

### Community 34 - "@fontsource-variable/geist"
Cohesion: 0.24
Nodes (15): AccessSigner, AuthOpts, makeAuthGuard(), makeSessionIssuer(), newRefreshToken(), now(), registerAuthRoutes(), sha256() (+7 more)

### Community 35 - "NavigationPanel.tsx"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 37 - "pmtiles"
Cohesion: 0.22
Nodes (9): Color, SheetView, Bool, Int, PresentationDetent, String, TimeInterval, Void (+1 more)

### Community 42 - "@tailwindcss/vite"
Cohesion: 0.18
Nodes (17): applyMapLanguage(), attachTerrainWhenReady(), DEFAULT_CENTER, ensure3DScenery(), flyDuration(), framePad(), liveMap, locateMapLibre() (+9 more)

### Community 46 - "AppleMapsClient"
Cohesion: 0.18
Nodes (7): AppleMapsClient, AppleMapsConfig, AppleSearchResult, port, makeAppleWebOAuth(), { privateKey }, privateKeyPem

### Community 47 - "createApp"
Cohesion: 0.15
Nodes (14): makeAccessSigner(), createDb(), registerDemRoutes(), listPacks(), PackInfo, registerPackRoutes(), createApp(), App (+6 more)

### Community 48 - "i18n.ts"
Cohesion: 0.11
Nodes (18): Existing web modules to modify, Explicit Non-Goals, File Structure, Global Constraints, mAiity Map Provider Parity Implementation Plan, Native modules to modify or create, New web modules, Success Criteria (+10 more)

### Community 49 - "Apple Web Login Design"
Cohesion: 0.22
Nodes (8): Apple Configuration, Apple Web Login Design, Authentication Flow, Failure Handling, Goal, Security, Verification, Web UI

### Community 50 - "MapScreen"
Cohesion: 0.19
Nodes (10): ColorScheme, MapScreen, CGFloat, CLLocationCoordinate2D, Double, MKCoordinateRegion, String, Void (+2 more)

### Community 51 - "CustomMapScreen"
Cohesion: 0.25
Nodes (7): App, MapsApp, RootView, Bool, CGFloat, PresentationDetent, Scene

### Community 52 - "driving.ts"
Cohesion: 0.27
Nodes (14): fmtDist(), fmtEta(), NavigationPanel(), bearingAtProgress(), distanceAlongGeometry(), pointAtProgress(), progressForElapsed(), bearing() (+6 more)

### Community 53 - "RaceHUDView"
Cohesion: 0.33
Nodes (6): DrivingState, finished, idle, paused, ready, running

### Community 54 - "AppleMapView.tsx"
Cohesion: 0.23
Nodes (12): addSelectionListener(), AppleMapView(), fitPlaces(), INITIAL_REGION, regionForPlace(), appleOverlayClass(), resolveAppleColorScheme(), resolveAppleMapType() (+4 more)

### Community 55 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Apple Web Login Implementation Plan, Global Constraints, Task 1: Backend OAuth flow, Task 2: Web login integration, Task 3: Apple portal and deployment

### Community 56 - "userpacks.ts"
Cohesion: 0.17
Nodes (10): Date, DrivingRun, DrivingRunStore, NavCamera, NavState, CLLocationCoordinate2D, Double, TimeInterval (+2 more)

### Community 61 - "drivingCamera.ts"
Cohesion: 0.50
Nodes (6): carPositionAt(), offsetAlongBearing(), offsetLateral(), RaceCamera, raceCameraAt(), LngLat

### Community 62 - "AppModel.swift"
Cohesion: 0.50
Nodes (4): Status, error, loading, ready

### Community 63 - "String"
Cohesion: 0.12
Nodes (9): ASAuthorization, Bool, String, User, Error, L, Language, String (+1 more)

### Community 65 - ".requestRoute"
Cohesion: 0.13
Nodes (10): CameraEvent, SheetPanel, none, packs, saved, Bookmark, GeoResult, Place (+2 more)

### Community 66 - "mAiity — Project Master Plan (web + native)"
Cohesion: 0.17
Nodes (11): Architecture notes, Definition of done (project health), Layout contract (do not violate), mAiity — Project Master Plan (web + native), P1 — next, P2 — polish, Principles, Related docs (+3 more)

### Community 68 - "RaceHUDView"
Cohesion: 0.19
Nodes (11): CGMutablePath, CGPoint, RaceHUDView, Bool, Double, Int, String, TimeInterval (+3 more)

### Community 69 - "Global Constraints"
Cohesion: 0.22
Nodes (8): Driving Game Mode Implementation Plan, Global Constraints, Task 1: Shared playback math, Task 2: Web driving session state, Task 3: Web car renderer and controls, Task 4: Native driving mode, Task 5: Run history and polish, Task 6: Deploy and verify

### Community 70 - "mAiity racing mode — product vision (v2)"
Cohesion: 0.25
Nodes (7): Acceptance checks, Bugfix pass (post ship), Intent, mAiity racing mode — product vision (v2), Must-have experience, Out of scope for first ship of this vision, Phased delivery

### Community 71 - "SwiftUI"
Cohesion: 0.21
Nodes (8): CoreLocation, PackPickerSheet, MapKit, MapLibre, MapLibreSwiftDSL, MapLibreSwiftUI, SwiftUI, UIKit

### Community 72 - "Double"
Cohesion: 0.42
Nodes (4): DrivingPhysics, DrivingPhysicsState, Double, TimeInterval

### Community 73 - "MapTokens"
Cohesion: 0.33
Nodes (5): Float, MapTokens, Double, UInt32, UIColor

### Community 74 - ".pick"
Cohesion: 0.38
Nodes (6): InstallPackSheet, Source, json, url, Bool, String

## Knowledge Gaps
- **278 isolated node(s):** `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script`, `deploy.sh script`, `loading` (+273 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `key()` connect `AppleMapView.tsx` to `PlaceCard.tsx`, `PoiIndex`, `route-packs.test.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `AppModel` connect `AppModel` to `.requestRoute`, `state.tsx`, `APIClient`, `RaceHUDView`, `pmtiles`, `Models.swift`, `SwiftUI`, `.pick`, `SheetView`, `CustomMapScreen`, `MapScreen`, `RaceHUDView`, `userpacks.ts`, `String`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `App.tsx`, `PackSwitcher.tsx`, `@tailwindcss/vite`, `PackSwitcher.tsx`, `AppleMapView.tsx`, `CustomMapScreen`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script` to the rest of the system?**
  _278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppModel` be split into smaller, more focused modules?**
  _Cohesion score 0.13105413105413105 - nodes in this community are weakly interconnected._
- **Should `state.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08669354838709678 - nodes in this community are weakly interconnected._
- **Should `APIClient` be split into smaller, more focused modules?**
  _Cohesion score 0.10638297872340426 - nodes in this community are weakly interconnected._