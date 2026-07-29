# mAiity — Project Master Plan (web + native)

**Updated:** 2026-07-29  
**Repo:** `enrzh/mAiity` · product on `maps.aiity.de`  
**Goal:** One map-first product across web and iOS — discover, route, navigate, race — with Apple Maps and custom packs as equal providers.

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
| Minimap (route + car) | ✅ | — (web) |
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
- [ ] Deploy web to `maps.aiity.de` and device-install iOS; full smoke matrix
- [ ] iOS race minimap (optional parity with web)
- [ ] Web reduced-motion: skip countdown animation fully; jump race cam
- [ ] MapLibre DEM terrain re-enable **or** remove dead DEM path
- [ ] Pack create on iOS **or** explicit “create on web” copy

### P2 — polish
- [ ] True 3D / mesh car (SceneKit or richer CSS)
- [ ] Haptics on more map actions (style toggle, locate)
- [ ] Lazy-load MapLibre when Apple-first
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
