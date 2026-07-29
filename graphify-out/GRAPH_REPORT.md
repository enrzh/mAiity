# Graph Report - maps  (2026-07-29)

## Corpus Check
- 120 files · ~88,159 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 840 nodes · 1720 edges · 61 communities (43 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec8ff578`
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
- MapTokens
- InstallPackSheet
- Global Constraints
- userpacks.ts
- lucide-react
- auth.test.ts
- sidebarState.ts
- 2026-07-29-map-controls-and-layout-plan.md
- @fontsource-variable/geist

## God Nodes (most connected - your core abstractions)
1. `cn()` - 66 edges
2. `AppModel` - 63 edges
3. `useApp()` - 38 edges
4. `useT()` - 32 edges
5. `APIClient` - 27 edges
6. `createApp()` - 22 edges
7. `LocationService` - 17 edges
8. `Button()` - 17 edges
9. `MapScreen` - 14 edges
10. `SheetView` - 13 edges

## Surprising Connections (you probably didn't know these)
- `makeApp()` --calls--> `createApp()`  [EXTRACTED]
  server/test/route-packs.test.ts → server/src/server.ts
- `makeApp()` --calls--> `createApp()`  [EXTRACTED]
  server/test/social.test.ts → server/src/server.ts
- `CardDescription()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/card.tsx → web/src/lib/utils.ts
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/card.tsx → web/src/lib/utils.ts
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/card.tsx → web/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (61 total, 18 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.15
Nodes (13): AppOpts, appleJWKS, AppleWebOAuth, googleJWKS, makeSocialVerifier(), now(), registerSocialRoutes(), SessionIssuer (+5 more)

### Community 1 - "AppModel"
Cohesion: 0.06
Nodes (34): AppModel, CameraEvent, NavCamera, NavState, RouteUI, SheetPanel, none, packs (+26 more)

### Community 2 - "state.tsx"
Cohesion: 0.33
Nodes (11): fmtDist(), fmtEta(), NavigationPanel(), bearing(), currentStep(), distanceM(), LngLat, metresToNextManeuver() (+3 more)

### Community 3 - "APIClient"
Cohesion: 0.10
Nodes (21): Data, Encodable, Error, APIClient, APIError, Bookmark, Bool, Double (+13 more)

### Community 4 - "make_pack_textures.swift"
Cohesion: 0.07
Nodes (37): CGMutablePath, CoreGraphics, Foundation, ImageIO, mapOutline(), rgb(), CGColor, CGFloat (+29 more)

### Community 5 - "App.tsx"
Cohesion: 0.12
Nodes (29): Detent, detentPx(), DETENTS, EmptyRail(), LANGS, LanguageMenu(), MapControls(), Panel (+21 more)

### Community 6 - "PackSwitcher.tsx"
Cohesion: 0.22
Nodes (12): fmtDistance(), PoiResults(), Button(), buttonVariants, Card(), CardAction(), CardContent(), CardDescription() (+4 more)

### Community 7 - "Models.swift"
Cohesion: 0.22
Nodes (25): Codable, Equatable, Identifiable, Bookmark, GeoResponse, GeoResult, NearbyCategory, Pack (+17 more)

### Community 8 - "PlaceCard.tsx"
Cohesion: 0.06
Nodes (58): AppleMapView(), applyMapLanguage(), DEFAULT_CENTER, ensure3DScenery(), flyDuration(), framePad(), locateMapLibre(), locateUser() (+50 more)

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
Nodes (13): class-variance-authority, clsx, radix-ui, react-dom, shadcn, tailwind-merge, dependencies, class-variance-authority (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.17
Nodes (11): bun-types, test, compilerOptions, module, moduleResolution, noEmit, strict, target (+3 more)

### Community 18 - "SheetView"
Cohesion: 0.19
Nodes (10): ASAuthorization, AuthenticationServices, AppConfig, AuthSheet, Mode, login, register, Error (+2 more)

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, devDependencies, @types/react, @types/react-dom (+3 more)

### Community 20 - "PackSwitcher.tsx"
Cohesion: 0.18
Nodes (16): ERROR_KEY, applySlots(), DEFAULTS, luminance(), shade(), SLOT_LABELS, Slots, Dialog() (+8 more)

### Community 22 - "View"
Cohesion: 0.19
Nodes (11): RootView, CGFloat, PresentationDetent, Color, SheetView, Bool, Int, PresentationDetent (+3 more)

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
Cohesion: 0.13
Nodes (11): App, CoreLocation, MapsApp, PackPickerSheet, MapKit, MapLibre, MapLibreSwiftDSL, MapLibreSwiftUI (+3 more)

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
Cohesion: 0.36
Nodes (4): Badge(), badgeVariants, Separator(), Skeleton()

### Community 49 - "Apple Web Login Design"
Cohesion: 0.22
Nodes (8): Apple Configuration, Apple Web Login Design, Authentication Flow, Failure Handling, Goal, Security, Verification, Web UI

### Community 50 - "MapScreen"
Cohesion: 0.21
Nodes (9): MapScreen, CGFloat, CLLocationCoordinate2D, Double, String, Void, MapCameraPosition, MapStyle (+1 more)

### Community 51 - "RoutePanel.tsx"
Cohesion: 0.33
Nodes (8): fmtDist(), fmtDur(), RoutePanel(), Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 53 - "MapTokens"
Cohesion: 0.33
Nodes (5): Float, MapTokens, Double, UInt32, UIColor

### Community 54 - "InstallPackSheet"
Cohesion: 0.32
Nodes (7): CaseIterable, InstallPackSheet, Source, json, url, Bool, String

### Community 55 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Apple Web Login Implementation Plan, Global Constraints, Task 1: Backend OAuth flow, Task 2: Web login integration, Task 3: Apple portal and deployment

### Community 56 - "userpacks.ts"
Cohesion: 0.70
Nodes (4): ensureUserPacksTable(), now(), registerUserPackRoutes(), validateStyle()

### Community 59 - "sidebarState.ts"
Cohesion: 0.80
Nodes (3): readSidebarCollapsed(), StorageLike, writeSidebarCollapsed()

## Knowledge Gaps
- **192 isolated node(s):** `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script`, `deploy.sh script`, `loading` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppModel` connect `AppModel` to `APIClient`, `LocationService`, `SheetView`, `MapScreen`, `InstallPackSheet`, `View`, `CustomMapScreen`, `SwiftUI`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `Foundation` connect `make_pack_textures.swift` to `AppModel`, `APIClient`, `Nav`, `Models.swift`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `LocationService` connect `LocationService` to `AppModel`, `CustomMapScreen`, `SwiftUI`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppModel` be split into smaller, more focused modules?**
  _Cohesion score 0.06198198198198198 - nodes in this community are weakly interconnected._
- **Should `APIClient` be split into smaller, more focused modules?**
  _Cohesion score 0.10374149659863946 - nodes in this community are weakly interconnected._
- **Should `make_pack_textures.swift` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._