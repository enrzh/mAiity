# Graph Report - maps  (2026-07-29)

## Corpus Check
- 136 files · ~98,407 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 965 nodes · 2014 edges · 69 communities (50 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `272677c7`
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
- RoutePanel.tsx
- Global Constraints
- Status

## God Nodes (most connected - your core abstractions)
1. `AppModel` - 75 edges
2. `cn()` - 66 edges
3. `useApp()` - 40 edges
4. `useT()` - 32 edges
5. `APIClient` - 27 edges
6. `createApp()` - 22 edges
7. `Button()` - 18 edges
8. `LocationService` - 17 edges
9. `AppProvider()` - 17 edges
10. `MapScreen` - 16 edges

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

## Communities (69 total, 19 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.15
Nodes (13): AppOpts, appleJWKS, AppleWebOAuth, googleJWKS, makeSocialVerifier(), now(), registerSocialRoutes(), SessionIssuer (+5 more)

### Community 2 - "state.tsx"
Cohesion: 0.05
Nodes (52): addSelectionListener(), AppleMapView(), fitPlaces(), INITIAL_REGION, regionForPlace(), applyMapLanguage(), DEFAULT_CENTER, ensure3DScenery() (+44 more)

### Community 3 - "APIClient"
Cohesion: 0.10
Nodes (21): Data, Encodable, Error, APIClient, APIError, Bookmark, Bool, Double (+13 more)

### Community 4 - "make_pack_textures.swift"
Cohesion: 0.07
Nodes (37): CGMutablePath, CoreGraphics, Foundation, ImageIO, mapOutline(), rgb(), CGColor, CGFloat (+29 more)

### Community 5 - "App.tsx"
Cohesion: 0.11
Nodes (35): Detent, detentPx(), DETENTS, EmptyRail(), LANGS, LanguageMenu(), MapControls(), Panel (+27 more)

### Community 6 - "PackSwitcher.tsx"
Cohesion: 0.17
Nodes (13): fmtDistance(), PoiResults(), Badge(), badgeVariants, Card(), CardAction(), CardContent(), CardDescription() (+5 more)

### Community 7 - "Models.swift"
Cohesion: 0.22
Nodes (25): Codable, Equatable, Identifiable, Bookmark, GeoResponse, GeoResult, NearbyCategory, Pack (+17 more)

### Community 8 - "PlaceCard.tsx"
Cohesion: 0.09
Nodes (34): bearingAtProgress(), distanceAlongGeometry(), pointAtProgress(), progressForElapsed(), DrivingGameState, stepDrivingGame(), createDrivingSession(), DrivingStatus (+26 more)

### Community 9 - "PoiIndex"
Cohesion: 0.11
Nodes (15): GeoResult, NEARBY_CATEGORIES, nextSlot, normalize(), PLACE_RANK, registerGeocodeRoutes(), degBox(), DETAIL_COLUMNS (+7 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "cn"
Cohesion: 0.10
Nodes (21): DialogFooter(), DialogOverlay(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+13 more)

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): fastify, @fastify/cookie, @fastify/cors, jose, dependencies, fastify, @fastify/cookie, @fastify/cors (+9 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): DOM, DOM.Iterable, ES2022, src/**/*.test.ts, compilerOptions, baseUrl, isolatedModules, jsx (+11 more)

### Community 14 - "LocationService"
Cohesion: 0.14
Nodes (13): CheckedContinuation, CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate, LocationService, Bool, CLLocationCoordinate2D (+5 more)

### Community 15 - "Nav"
Cohesion: 0.24
Nodes (8): Element, CLLocationCoordinate2D, Array, Nav, Snapped, Double, Int, RouteStep

### Community 16 - "dependencies"
Cohesion: 0.15
Nodes (13): class-variance-authority, radix-ui, react-dom, shadcn, tailwind-merge, @tailwindcss/vite, dependencies, class-variance-authority (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.17
Nodes (11): bun-types, test, compilerOptions, module, moduleResolution, noEmit, strict, target (+3 more)

### Community 18 - "SheetView"
Cohesion: 0.12
Nodes (17): ASAuthorization, AuthenticationServices, CaseIterable, AppConfig, AuthSheet, Mode, login, register (+9 more)

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, devDependencies, @types/react, @types/react-dom (+3 more)

### Community 20 - "PackSwitcher.tsx"
Cohesion: 0.14
Nodes (20): ERROR_KEY, applySlots(), DEFAULTS, luminance(), shade(), SLOT_LABELS, Slots, Dialog() (+12 more)

### Community 22 - "View"
Cohesion: 0.24
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
Cohesion: 0.17
Nodes (8): CoreLocation, PackPickerSheet, MapKit, MapLibre, MapLibreSwiftDSL, MapLibreSwiftUI, SwiftUI, UIKit

### Community 29 - "clsx"
Cohesion: 0.22
Nodes (8): Apple Authentication, Architecture, Goal, mAiity Map Controls and Layout Design, Native Map Controls, Testing, Web Layout, Web Map Controls

### Community 34 - "@fontsource-variable/geist"
Cohesion: 0.33
Nodes (11): AccessSigner, AuthOpts, makeAuthGuard(), makeSessionIssuer(), newRefreshToken(), now(), registerAuthRoutes(), sha256() (+3 more)

### Community 35 - "NavigationPanel.tsx"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 42 - "@tailwindcss/vite"
Cohesion: 0.12
Nodes (26): ICONS, api, authed(), Bookmark, GeoResult, NEARBY_CATEGORIES, NearbyCategory, Pack (+18 more)

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
Cohesion: 0.20
Nodes (10): ColorScheme, MapScreen, CGFloat, CLLocationCoordinate2D, Double, String, Void, MapCameraPosition (+2 more)

### Community 51 - "RoutePanel.tsx"
Cohesion: 0.53
Nodes (3): L, Language, String

### Community 52 - "RootView"
Cohesion: 0.29
Nodes (6): App, MapsApp, RootView, CGFloat, PresentationDetent, Scene

### Community 53 - "MapTokens"
Cohesion: 0.33
Nodes (5): Float, MapTokens, Double, UInt32, UIColor

### Community 54 - "InstallPackSheet"
Cohesion: 0.80
Nodes (3): readSidebarCollapsed(), StorageLike, writeSidebarCollapsed()

### Community 55 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Apple Web Login Implementation Plan, Global Constraints, Task 1: Backend OAuth flow, Task 2: Web login integration, Task 3: Apple portal and deployment

### Community 56 - "userpacks.ts"
Cohesion: 0.70
Nodes (4): ensureUserPacksTable(), now(), registerUserPackRoutes(), validateStyle()

### Community 59 - "sidebarState.ts"
Cohesion: 0.50
Nodes (4): SheetPanel, none, packs, saved

### Community 62 - "AppModel.swift"
Cohesion: 0.17
Nodes (14): Date, DrivingRun, DrivingRunStore, DrivingState, finished, idle, paused, ready (+6 more)

### Community 63 - "String"
Cohesion: 0.14
Nodes (8): AppModel, Bool, Never, Pack, String, URL, User, Void

### Community 65 - ".requestRoute"
Cohesion: 0.18
Nodes (6): CameraEvent, Bookmark, GeoResult, Place, GeoResult, Place

### Community 67 - "RoutePanel.tsx"
Cohesion: 0.38
Nodes (7): DrivingModePanel(), fmtTime(), fmtDist(), fmtDur(), RoutePanel(), Button(), buttonVariants

### Community 69 - "Global Constraints"
Cohesion: 0.22
Nodes (8): Driving Game Mode Implementation Plan, Global Constraints, Task 1: Shared playback math, Task 2: Web driving session state, Task 3: Web car renderer and controls, Task 4: Native driving mode, Task 5: Run history and polish, Task 6: Deploy and verify

### Community 71 - "Status"
Cohesion: 0.22
Nodes (7): RouteUI, Status, error, loading, ready, RouteMode, RouteResult

## Knowledge Gaps
- **225 isolated node(s):** `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script`, `deploy.sh script`, `loading` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `key()` connect `state.tsx` to `PlaceCard.tsx`, `PoiIndex`, `route-packs.test.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `AppModel` connect `String` to `.requestRoute`, `AppModel`, `APIClient`, `Status`, `SwiftUI`, `LocationService`, `Nav`, `SheetView`, `RoutePanel.tsx`, `RootView`, `MapScreen`, `View`, `CustomMapScreen`, `sidebarState.ts`, `AppModel.swift`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `registerGeocodeRoutes()` connect `PoiIndex` to `state.tsx`, `AppleMapsClient`, `createApp`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `state.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05365296803652968 - nodes in this community are weakly interconnected._
- **Should `APIClient` be split into smaller, more focused modules?**
  _Cohesion score 0.10374149659863946 - nodes in this community are weakly interconnected._
- **Should `make_pack_textures.swift` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._