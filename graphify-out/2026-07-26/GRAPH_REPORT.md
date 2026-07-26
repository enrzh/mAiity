# Graph Report - maps  (2026-07-26)

## Corpus Check
- 95 files · ~61,982 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 688 nodes · 1397 edges · 46 communities (30 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `df70d0f5`
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
- SwiftUI
- AuthSheet
- View
- maps — web + native map with swappable texture packs
- package.json
- MapScreen.swift
- InstallPackSheet
- .handleApple
- dl-planet.sh
- clsx
- build-poi-db.sh
- build-pois.sh
- build-tiles.sh
- deploy.sh
- @fontsource-variable/geist
- lucide-react
- next-themes
- pmtiles
- react
- build-poi-db.sh
- sonner
- tailwindcss
- @tailwindcss/vite
- tw-animate-css

## God Nodes (most connected - your core abstractions)
1. `cn()` - 63 edges
2. `AppModel` - 59 edges
3. `useApp()` - 32 edges
4. `APIClient` - 27 edges
5. `createApp()` - 22 edges
6. `LocationService` - 17 edges
7. `Button()` - 17 edges
8. `PoiIndex` - 12 edges
9. `compilerOptions` - 12 edges
10. `SheetView` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AuthDialogContent()` --calls--> `useApp()`  [EXTRACTED]
  web/src/components/AuthModal.tsx → web/src/state.tsx
- `CardDescription()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/card.tsx → web/src/lib/utils.ts
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/card.tsx → web/src/lib/utils.ts
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/card.tsx → web/src/lib/utils.ts
- `DialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  web/src/components/ui/dialog.tsx → web/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (46 total, 16 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.05
Nodes (52): AccessSigner, AuthOpts, makeAccessSigner(), makeAuthGuard(), makeSessionIssuer(), newRefreshToken(), now(), registerAuthRoutes() (+44 more)

### Community 1 - "AppModel"
Cohesion: 0.07
Nodes (27): AppModel, CameraEvent, NavCamera, NavState, RouteUI, Status, error, loading (+19 more)

### Community 2 - "state.tsx"
Cohesion: 0.08
Nodes (44): DEFAULT_CENTER, ensure3DScenery(), framePad(), liveMap, locateUser(), MapView(), railInset, NOTE: no built-in NavigationControl/GeolocateControl — they render in (+36 more)

### Community 3 - "APIClient"
Cohesion: 0.10
Nodes (21): Data, Encodable, Error, APIClient, APIError, Bookmark, Bool, Double (+13 more)

### Community 4 - "make_pack_textures.swift"
Cohesion: 0.07
Nodes (37): CGMutablePath, CoreGraphics, Foundation, ImageIO, mapOutline(), rgb(), CGColor, CGFloat (+29 more)

### Community 5 - "App.tsx"
Cohesion: 0.08
Nodes (29): EmptyRail(), MapControls(), Panel, RailControls(), Shell(), CategoryChips(), centerOf(), ICONS (+21 more)

### Community 6 - "PackSwitcher.tsx"
Cohesion: 0.12
Nodes (25): AuthDialogContent(), AuthModal(), ERROR_TEXT, applySlots(), DEFAULTS, luminance(), PackEditor(), shade() (+17 more)

### Community 7 - "Models.swift"
Cohesion: 0.20
Nodes (26): CaseIterable, Codable, Equatable, Identifiable, Bookmark, GeoResponse, GeoResult, NearbyCategory (+18 more)

### Community 8 - "PlaceCard.tsx"
Cohesion: 0.16
Nodes (17): fmtDistance(), PoiResults(), fmtDist(), fmtDur(), RoutePanel(), SavedPanel(), Button(), buttonVariants (+9 more)

### Community 9 - "PoiIndex"
Cohesion: 0.13
Nodes (12): GeoResult, NEARBY_CATEGORIES, nextSlot, normalize(), registerGeocodeRoutes(), degBox(), DETAIL_COLUMNS, distanceM() (+4 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "cn"
Cohesion: 0.18
Nodes (11): Badge(), badgeVariants, ScrollArea(), ScrollBar(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader() (+3 more)

### Community 12 - "package.json"
Cohesion: 0.11
Nodes (17): fastify, @fastify/cookie, @fastify/cors, jose, dependencies, fastify, @fastify/cookie, @fastify/cors (+9 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): DOM, DOM.Iterable, ES2022, compilerOptions, baseUrl, isolatedModules, jsx, lib (+9 more)

### Community 14 - "LocationService"
Cohesion: 0.15
Nodes (12): CheckedContinuation, CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate, LocationService, Bool, Error (+4 more)

### Community 15 - "Nav"
Cohesion: 0.26
Nodes (7): Element, Array, Nav, Snapped, Double, Int, RouteStep

### Community 16 - "dependencies"
Cohesion: 0.15
Nodes (13): class-variance-authority, maplibre-gl, radix-ui, react-dom, shadcn, tailwind-merge, dependencies, class-variance-authority (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.17
Nodes (11): bun-types, test, compilerOptions, module, moduleResolution, noEmit, strict, target (+3 more)

### Community 18 - "SheetView"
Cohesion: 0.29
Nodes (6): Color, SheetView, Bool, Int, PresentationDetent, String

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react, devDependencies, @types/react, @types/react-dom (+3 more)

### Community 20 - "SwiftUI"
Cohesion: 0.20
Nodes (8): App, MapsApp, RootView, CGFloat, PresentationDetent, PackPickerSheet, Scene, SwiftUI

### Community 21 - "AuthSheet"
Cohesion: 0.31
Nodes (7): AuthenticationServices, AppConfig, AuthSheet, Mode, login, register, String

### Community 22 - "View"
Cohesion: 0.25
Nodes (7): MapScreen, CGFloat, String, Void, Place, ShapeSource, View

### Community 23 - "maps — web + native map with swappable texture packs"
Cohesion: 0.22
Nodes (8): Add rich POIs (Overture + Foursquare), iOS, Layout, Make it *your* map (self-hosted tiles), maps — web + native map with swappable texture packs, Notes / gotchas, Roadmap, Run the web client

### Community 24 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 25 - "MapScreen.swift"
Cohesion: 0.29
Nodes (5): CoreLocation, MapLibre, MapLibreSwiftDSL, MapLibreSwiftUI, UIKit

### Community 26 - "InstallPackSheet"
Cohesion: 0.38
Nodes (6): InstallPackSheet, Source, json, url, Bool, String

### Community 27 - ".handleApple"
Cohesion: 0.50
Nodes (3): ASAuthorization, Error, Result

## Knowledge Gaps
- **144 isolated node(s):** `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script`, `deploy.sh script`, `loading` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppModel` connect `AppModel` to `APIClient`, `LocationService`, `SheetView`, `SwiftUI`, `AuthSheet`, `View`, `InstallPackSheet`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `Foundation` connect `make_pack_textures.swift` to `AppModel`, `APIClient`, `Nav`, `Models.swift`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `LocationService` connect `LocationService` to `MapScreen.swift`, `AppModel`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `build-poi-db.sh script`, `build-pois.sh script`, `build-tiles.sh script` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05438184663536776 - nodes in this community are weakly interconnected._
- **Should `AppModel` be split into smaller, more focused modules?**
  _Cohesion score 0.07373271889400922 - nodes in this community are weakly interconnected._
- **Should `state.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08069381598793364 - nodes in this community are weakly interconnected._