# mAiity — Project Master Plan (web + native)

**Updated:** 2026-07-29 (UI zones + rail flatten + deploy)  
**Repo:** `enrzh/mAiity` · product on `maps.aiity.de`  
**Goal:** One map-first product across web and iOS — discover, route, navigate, race — with Apple Maps and custom packs as equal providers.

## Layout contract (do not violate)

| Zone | Owner | Must not share with |
|------|--------|---------------------|
| Top centre | Status / search-this-area | Race HUD, sheet |
| Bottom | Race HUD **or** mobile sheet | Both at once |
| Bottom-right | Map zoom/locate | Race touch pads (phone) |
| Left (desktop) | Rail 360px | Floating race chrome on left edge |

---

## Principles

1. Map is the primary surface.
2. One UI surface at a time (packs / saved / route / race / search).
3. Apple Maps is a **provider**, not a MapLibre skin.
4. Race mode is **car routes only**.
5. Platform-native feel; WCAG AA + iOS a11y (44pt, VO, reduced motion).

---

## Shipped (as of this plan)

| Area | Web | iOS |
|------|-----|-----|
| Race physics (throttle/brake/steer) | ✅ | ✅ |
| Race map overlay HUD + touch pads | ✅ | ✅ |
| Street chase cam (Apple + custom) | ✅ | ✅ |
| Lateral lane offset | ✅ | ✅ |
| 3-2-1 countdown | ✅ | ✅ |
| Minimap (route + car) | ✅ | ✅ |
| Run history UI | ✅ | ✅ |
| Pack / route panel exclusivity | ✅ | ✅ (pack picker) |
| TBT follow cam on Apple | ✅ | ✅ |
| Search this area (both providers) | ✅ | ✅ |
| Viewport persistence | ✅ Apple + custom | ✅ prefs + viewport |
| Map load recovery (MapStatus) | ✅ | partial (bootFailed) |
| Unified prefs `v1` | ✅ | ✅ `MapPersistence` |
| Race i18n (8 langs) | ✅ | ✅ |
| Keyboard shortcuts `/` `+/-` Esc | ✅ | n/a |
| Empty-map reverse geocode | ✅ | ✅ |
| Custom map zoom controls | ✅ | ✅ |
| Reduced motion race pitch | partial | ✅ |

---

## Remaining backlog

### P1 — next
- [x] Deploy web to `maps.aiity.de` *(when deploy.sh succeeds)*
- [x] iOS race minimap
- [x] MapLibre DEM terrain re-enable with deferred attach (no blank map)
- [x] Lazy-load MapLibre / Apple engines (code-split)
- [ ] Device-install iOS; full smoke matrix on phone
- [ ] Pack create on iOS **or** explicit “create on web” copy

### P2 — polish
- [ ] True 3D / mesh car (SceneKit or richer CSS)
- [ ] Haptics on more map actions (style toggle, locate)
- [ ] Continuous location stream on iOS nav (vs 2s poll)
- [ ] Multiplayer / leaderboards (out of scope unless re-prioritized)

---

## Architecture notes

```
web/
  maps/rendererController  → provider-neutral zoom/locate/follow/moveEnd
  lib/driving*             → race session + physics + camera
  components/MapStatus     → recovery UI
  components/DrivingModePanel → race HUD + countdown + minimap + history

ios/
  MapPersistence           → prefs v1 + viewport
  DrivingPhysics           → mirrors web game loop
  RaceHUDView              → map overlay controls
  AppModel.noteMapRegion   → search-this-area + viewport write
```

---

## Smoke matrix (release)

| Check | Web custom | Web Apple | iOS custom | iOS Apple |
|-------|------------|-----------|------------|-----------|
| Search + place card | | | | |
| Category + search this area | | | | |
| Car route + race full loop | | | | |
| TBT navigation | | | | |
| Pack switch / Apple type | | | | |
| Auth (email / Apple) | | | | |
| Cold start restores provider/viewport | | | | |

---

## Definition of done (project health)

1. `bun test` green; web production build green.  
2. iOS `xcodebuild` green.  
3. P0/P1 product gaps from improvement plan closed or deferred with reason.  
4. PRODUCT.md principles still hold.  
5. Production smoke after deploy.

---

## Related docs

- `2026-07-29-web-ios-improvement-plan.md` — phased task detail  
- `2026-07-29-racing-mode-vision.md` — race vision A–F  
- `2026-07-29-map-provider-parity.md` — provider architecture  
- `PRODUCT.md` — product principles  
