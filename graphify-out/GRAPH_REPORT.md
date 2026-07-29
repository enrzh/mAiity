# Graph Report - maps  (2026-07-29)

## Corpus Check
- 112 files · ~86,761 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 795 nodes · 1644 edges · 56 communities (39 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `623eccd2`
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
- Apple Web Login Design
- MapScreen
- RootView
- MapTokens
- InstallPackSheet
- Global Constraints
- userpacks.ts
- lucide-react
- auth.test.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 66 edges
2. `AppModel` - 63 edges
3. `useApp()` - 38 edges
4. `useT()` - 32 edges
5. `APIClient` - 27 edges
6. `createApp()` - 22 edges
7. `LocationService` - 17 edges
8. `Button()` - 17 edges
9. `SheetView` - 13 edges
10. `PoiIndex` - 13 edges

## Surprising Connections (you probably didn't know these)
- `makeApp()` --calls--> `createApp()`  [EXTRACTED]
  server/test/route-packs.test.ts → server/src/server.ts
- `makeApp()` --calls--> `createApp()`  [EXTRACTED]
  server/test/social.test.ts → server/src/server.ts
- `AppProvider()` --calls--> `tr`  [EXTRACTED]
  web/src/state.tsx → web/src/lib/i18n.ts
- `AuthSheet` --references--> `AppModel`  [EXTRACTED]
  ios/MapsApp/AuthSheet.swift → ios/MapsApp/AppModel.swift
- `CustomMapScreen` --references--> `AppModel`  [EXTRACTED]
  ios/MapsApp/CustomMapScreen.swift → ios/MapsApp/AppModel.swift

## Import Cycles
- None detected.

## Communities (56 total, 17 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.15
Nodes (13): AppOpts, appleJWKS, AppleWebOAuth, googleJWKS, makeSocialVerifier(), now(), registerSocialRoutes(), SessionIssuer (+5 more)

### Community 1 - "AppModel"
Cohesion: 0.06
Nodes (34): AppModel, CameraEvent, NavCamera, NavState, RouteUI, SheetPanel, none, packs (+26 more)

### Community 2 - "state.tsx"
Cohesion: 0.16
Nodes (23): authed(), Bookmark, GeoResult, NearbyCategory, Pack, parseError(), PlaceDetails, refreshSession() (+15 more)

### Community 3 - "APIClient"
Cohesion: 0.10
Nodes (21): Data, Encodable, Error, APIClient, APIError, Bookmark, Bool, Double (+13 more)

### Community 4 - "make_pack_textures.swift"
Cohesion: 0.07
Nodes (37): CGMutablePath, CoreGraphics, Foundation, ImageIO, mapOutline(), rgb(), CGColor, CGFloat (+29 more)

### Community 5 - "App.tsx"
Cohesion: 0.14
Nodes (27): Detent, detentPx(), DETENTS, EmptyRail(), LANGS, LanguageMenu(), MapControls(), Panel (+19 more)

### Community 6 - "PackSwitcher.tsx"
Cohesion: 0.20
Nodes (10): liveMap, fmtDist(), fmtDur(), RoutePanel(), Button(), buttonVariants, Card(), CardContent() (+2 more)

### Community 7 - "Models.swift"
Cohesion: 0.22
Nodes (25): Codable, Equatable, Identifiable, Bookmark, GeoResponse, GeoResult, NearbyCategory, Pack (+17 more)

### Community 8 - "PlaceCard.tsx"
Cohesion: 0.13
Nodes (19): AppleMapView(), applyMapLanguage(), DEFAULT_CENTER, ensure3DScenery(), flyDuration(), framePad(), locateUser(), MapLibreMapView() (+11 more)

### Community 9 - "PoiIndex"
Cohesion: 0.11
Nodes (15): GeoResult, NEARBY_CATEGORIES, nextSlot, normalize(), PLACE_RANK, registerGeocodeRoutes(), degBox(), DETAIL_COLUMNS (+7 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "cn"
Cohesion: 0.05
Nodes (60): ERROR_KEY, applySlots(), DEFAULTS, luminance(), PackEditor(), shade(), SLOT_LABELS, Slots (+52 more)

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): fastify, @fastify/cookie, @fastify/cors, jose, dependencies, fastify, @fastify/cookie, @fastify/cors (+9 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): DOM, DOM.Iterable, ES2022, compilerOptions, baseUrl, isolatedModules, jsx, lib (+9 more)

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

### Community 22 - "View"
Cohesion: 0.27
Nodes (8): Color, SheetView, Bool, Int, PresentationDetent, String, Void, View

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

### Community 34 - "@fontsource-variable/geist"
Cohesion: 0.33
Nodes (11): AccessSigner, AuthOpts, makeAuthGuard(), makeSessionIssuer(), newRefreshToken(), now(), registerAuthRoutes(), sha256() (+3 more)

### Community 35 - "NavigationPanel.tsx"
Cohesion: 0.31
Nodes (12): showUserDot(), fmtDist(), fmtEta(), NavigationPanel(), bearing(), currentStep(), distanceM(), LngLat (+4 more)

### Community 46 - "AppleMapsClient"
Cohesion: 0.18
Nodes (7): AppleMapsClient, AppleMapsConfig, AppleSearchResult, port, makeAppleWebOAuth(), { privateKey }, privateKeyPem

### Community 47 - "createApp"
Cohesion: 0.15
Nodes (14): makeAccessSigner(), createDb(), registerDemRoutes(), listPacks(), PackInfo, registerPackRoutes(), createApp(), App (+6 more)

### Community 49 - "Apple Web Login Design"
Cohesion: 0.22
Nodes (8): Apple Configuration, Apple Web Login Design, Authentication Flow, Failure Handling, Goal, Security, Verification, Web UI

### Community 50 - "MapScreen"
Cohesion: 0.33
Nodes (7): MapScreen, CGFloat, CLLocationCoordinate2D, Double, MapCameraPosition, MapStyle, MKCoordinateRegion

### Community 52 - "RootView"
Cohesion: 0.29
Nodes (6): App, MapsApp, RootView, CGFloat, PresentationDetent, Scene

### Community 53 - "MapTokens"
Cohesion: 0.33
Nodes (5): Float, MapTokens, Double, UInt32, UIColor

### Community 54 - "InstallPackSheet"
Cohesion: 0.38
Nodes (6): InstallPackSheet, Source, json, url, Bool, String

### Community 55 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Apple Web Login Implementation Plan, Global Constraints, Task 1: Backend OAuth flow, Task 2: Web login integration, Task 3: Apple portal and deployment

### Community 56 - "userpacks.ts"
Cohesion: 0.70
Nodes (4): ensureUserPacksTable(), now(), registerUserPackRoutes(), validateStyle()

## Knowledge Gaps
- **176 isolated node(s):** `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script`, `deploy.sh script`, `loading` (+171 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppModel` connect `AppModel` to `APIClient`, `LocationService`, `SheetView`, `MapScreen`, `RootView`, `InstallPackSheet`, `View`, `CustomMapScreen`, `SwiftUI`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `Foundation` connect `make_pack_textures.swift` to `AppModel`, `APIClient`, `Nav`, `Models.swift`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `LocationService` connect `LocationService` to `AppModel`, `CustomMapScreen`, `SwiftUI`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script` to the rest of the system?**
  _176 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppModel` be split into smaller, more focused modules?**
  _Cohesion score 0.06330988522769344 - nodes in this community are weakly interconnected._
- **Should `APIClient` be split into smaller, more focused modules?**
  _Cohesion score 0.10374149659863946 - nodes in this community are weakly interconnected._
- **Should `make_pack_textures.swift` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._