# Graph Report - maps  (2026-07-29)

## Corpus Check
- 134 files · ~97,880 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 961 nodes · 2014 edges · 73 communities (54 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bab5d2df`
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
- SwiftUI
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
- RoutePanel.tsx
- RootView
- MapTokens
- InstallPackSheet
- Global Constraints
- userpacks.ts
- lucide-react
- auth.test.ts
- sidebarState.ts
- 2026-07-29-map-controls-and-layout-plan.md
- @fontsource-variable/geist
- AppModel.swift
- String
- rendererController.ts
- .requestRoute
- AppleMapView.tsx
- RoutePanel.tsx
- .advance
- Global Constraints
- .select
- Status
- MemoryStorage

## God Nodes (most connected - your core abstractions)
1. `AppModel` - 75 edges
2. `cn()` - 66 edges
3. `useApp()` - 40 edges
4. `useT()` - 34 edges
5. `APIClient` - 27 edges
6. `createApp()` - 22 edges
7. `Button()` - 18 edges
8. `LocationService` - 17 edges
9. `MapScreen` - 16 edges
10. `AppProvider()` - 16 edges

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

## Communities (73 total, 19 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.15
Nodes (13): AppOpts, appleJWKS, AppleWebOAuth, googleJWKS, makeSocialVerifier(), now(), registerSocialRoutes(), SessionIssuer (+5 more)

### Community 1 - "AppModel"
Cohesion: 0.15
Nodes (7): AppModel, Never, Pack, Task, URL, Void, NearbyCategory

### Community 2 - "state.tsx"
Cohesion: 0.18
Nodes (16): applyMapLanguage(), DEFAULT_CENTER, ensure3DScenery(), flyDuration(), framePad(), locateMapLibre(), locateUser(), MapLibreMapView() (+8 more)

### Community 3 - "APIClient"
Cohesion: 0.10
Nodes (21): Data, Encodable, Error, APIClient, APIError, Bookmark, Bool, Double (+13 more)

### Community 4 - "make_pack_textures.swift"
Cohesion: 0.07
Nodes (37): CGMutablePath, CoreGraphics, Foundation, ImageIO, mapOutline(), rgb(), CGColor, CGFloat (+29 more)

### Community 5 - "App.tsx"
Cohesion: 0.10
Nodes (34): Detent, detentPx(), DETENTS, EmptyRail(), LANGS, LanguageMenu(), MapControls(), Panel (+26 more)

### Community 6 - "PackSwitcher.tsx"
Cohesion: 0.20
Nodes (11): PlaceCard(), Badge(), badgeVariants, Card(), CardAction(), CardContent(), CardDescription(), CardFooter() (+3 more)

### Community 7 - "Models.swift"
Cohesion: 0.22
Nodes (25): Codable, Equatable, Identifiable, Bookmark, GeoResponse, GeoResult, NearbyCategory, Pack (+17 more)

### Community 8 - "PlaceCard.tsx"
Cohesion: 0.08
Nodes (49): api, authed(), Bookmark, GeoResult, NearbyCategory, Pack, parseError(), PlaceDetails (+41 more)

### Community 9 - "PoiIndex"
Cohesion: 0.11
Nodes (15): GeoResult, NEARBY_CATEGORIES, nextSlot, normalize(), PLACE_RANK, registerGeocodeRoutes(), degBox(), DETAIL_COLUMNS (+7 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "cn"
Cohesion: 0.10
Nodes (20): DialogFooter(), DialogOverlay(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+12 more)

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): fastify, @fastify/cookie, @fastify/cors, jose, dependencies, fastify, @fastify/cookie, @fastify/cors (+9 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, DOM.Iterable, ES2022, src/**/*.test.ts, compilerOptions, baseUrl, isolatedModules, jsx (+11 more)

### Community 14 - "LocationService"
Cohesion: 0.15
Nodes (13): CheckedContinuation, CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate, LocationService, Bool, CLLocationCoordinate2D (+5 more)

### Community 15 - "Nav"
Cohesion: 0.26
Nodes (7): Element, Array, Nav, Snapped, Double, Int, RouteStep

### Community 16 - "dependencies"
Cohesion: 0.15
Nodes (13): class-variance-authority, @fontsource-variable/geist, radix-ui, react-dom, shadcn, tailwind-merge, dependencies, class-variance-authority (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.17
Nodes (11): bun-types, test, compilerOptions, module, moduleResolution, noEmit, strict, target (+3 more)

### Community 18 - "SheetView"
Cohesion: 0.18
Nodes (11): ASAuthorization, AuthenticationServices, CaseIterable, AppConfig, AuthSheet, Mode, login, register (+3 more)

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, devDependencies, @types/react, @types/react-dom (+3 more)

### Community 20 - "PackSwitcher.tsx"
Cohesion: 0.13
Nodes (22): ERROR_KEY, applySlots(), DEFAULTS, luminance(), PackEditor(), shade(), SLOT_LABELS, Slots (+14 more)

### Community 22 - "View"
Cohesion: 0.22
Nodes (9): Color, SheetView, Bool, Int, PresentationDetent, String, TimeInterval, Void (+1 more)

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
Cohesion: 0.20
Nodes (9): CustomMapScreen, CGFloat, CLLocationCoordinate2D, Double, Place, String, URL, Void (+1 more)

### Community 27 - "SwiftUI"
Cohesion: 0.20
Nodes (7): CoreLocation, PackPickerSheet, MapKit, MapLibre, MapLibreSwiftDSL, MapLibreSwiftUI, SwiftUI

### Community 29 - "clsx"
Cohesion: 0.22
Nodes (8): Apple Authentication, Architecture, Goal, mAiity Map Controls and Layout Design, Native Map Controls, Testing, Web Layout, Web Map Controls

### Community 34 - "@fontsource-variable/geist"
Cohesion: 0.33
Nodes (11): AccessSigner, AuthOpts, makeAuthGuard(), makeSessionIssuer(), newRefreshToken(), now(), registerAuthRoutes(), sha256() (+3 more)

### Community 35 - "NavigationPanel.tsx"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

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
Nodes (10): ColorScheme, MapScreen, CGFloat, CLLocationCoordinate2D, Double, String, Void, MapCameraPosition (+2 more)

### Community 51 - "RoutePanel.tsx"
Cohesion: 0.18
Nodes (10): de, DICTS, en, es, fr, it, makeT(), nl (+2 more)

### Community 52 - "RootView"
Cohesion: 0.29
Nodes (6): App, MapsApp, RootView, CGFloat, PresentationDetent, Scene

### Community 53 - "MapTokens"
Cohesion: 0.29
Nodes (6): Float, MapTokens, Double, UInt32, UIColor, UIKit

### Community 54 - "InstallPackSheet"
Cohesion: 0.38
Nodes (6): InstallPackSheet, Source, json, url, Bool, String

### Community 55 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Apple Web Login Implementation Plan, Global Constraints, Task 1: Backend OAuth flow, Task 2: Web login integration, Task 3: Apple portal and deployment

### Community 56 - "userpacks.ts"
Cohesion: 0.70
Nodes (4): ensureUserPacksTable(), now(), registerUserPackRoutes(), validateStyle()

### Community 59 - "sidebarState.ts"
Cohesion: 0.24
Nodes (16): liveMap, showUserDot(), fmtDist(), fmtEta(), NavigationPanel(), bearingAtProgress(), distanceAlongGeometry(), pointAtProgress() (+8 more)

### Community 62 - "AppModel.swift"
Cohesion: 0.16
Nodes (10): Date, CameraEvent, DrivingRun, DrivingRunStore, SheetPanel, none, packs, saved (+2 more)

### Community 63 - "String"
Cohesion: 0.20
Nodes (6): Bool, String, User, L, Language, String

### Community 64 - "rendererController.ts"
Cohesion: 0.17
Nodes (9): activeMapCapabilities(), focusActiveMapPlace(), locateActiveMap(), registerMapRenderer(), setActiveMap3D(), zoomActiveMap(), MapRendererCapabilities, MapRendererController (+1 more)

### Community 65 - ".requestRoute"
Cohesion: 0.19
Nodes (5): RouteUI, Place, RouteMode, RouteResult, Place

### Community 66 - "AppleMapView.tsx"
Cohesion: 0.27
Nodes (12): addSelectionListener(), AppleMapView(), fitPlaces(), INITIAL_REGION, regionForPlace(), appleOverlayClass(), resolveAppleColorScheme(), resolveAppleMapType() (+4 more)

### Community 67 - "RoutePanel.tsx"
Cohesion: 0.31
Nodes (9): DrivingModePanel(), fmtDist(), fmtTime(), fmtDist(), fmtDur(), RoutePanel(), Button(), buttonVariants (+1 more)

### Community 68 - ".advance"
Cohesion: 0.24
Nodes (10): DrivingState, finished, idle, paused, ready, running, NavCamera, NavState (+2 more)

### Community 69 - "Global Constraints"
Cohesion: 0.22
Nodes (8): Driving Game Mode Implementation Plan, Global Constraints, Task 1: Shared playback math, Task 2: Web driving session state, Task 3: Web car renderer and controls, Task 4: Native driving mode, Task 5: Run history and polish, Task 6: Deploy and verify

### Community 70 - ".select"
Cohesion: 0.33
Nodes (3): Bookmark, GeoResult, GeoResult

### Community 71 - "Status"
Cohesion: 0.50
Nodes (4): Status, error, loading, ready

## Knowledge Gaps
- **224 isolated node(s):** `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script`, `deploy.sh script`, `loading` (+219 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `key()` connect `AppleMapView.tsx` to `PlaceCard.tsx`, `PoiIndex`, `route-packs.test.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `AppModel` connect `AppModel` to `.requestRoute`, `APIClient`, `.advance`, `.select`, `LocationService`, `SheetView`, `MapScreen`, `RootView`, `InstallPackSheet`, `View`, `CustomMapScreen`, `SwiftUI`, `AppModel.swift`, `String`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `registerGeocodeRoutes()` connect `PoiIndex` to `AppleMapView.tsx`, `AppleMapsClient`, `createApp`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script` to the rest of the system?**
  _224 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `APIClient` be split into smaller, more focused modules?**
  _Cohesion score 0.10374149659863946 - nodes in this community are weakly interconnected._
- **Should `make_pack_textures.swift` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10175763182238667 - nodes in this community are weakly interconnected._