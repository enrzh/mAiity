# mAiity racing mode — product vision (v2)

## Intent

When the user turns on **driving / racing mode** on a car route, mAiity should feel like a **lightweight racing game** over real map data — not only a HUD + route progress marker.

Applies to:

- **Custom texture packs** (MapLibre / packs)
- **Apple Maps** renderer
- **Web + mobile** (desktop keyboard + touch; native iOS parity)

## Must-have experience

1. **Street-level 3D scenery**
   - High pitch / follow-camera along the route
   - Extruded buildings / pack buildings readable at street scale on custom packs
   - Apple: maximum pitch + 3D where MapKit allows; hybrid/satellite optional for “looks real”
2. **Racing game feel**
   - 3D (or strong 2.5D) car model, not only a flat icon
   - Throttle / brake / steer (keyboard + on-screen pads on mobile)
   - Optional time trial + local run history (already started)
3. **One UI surface at a time**
   - Starting a race closes packs/saved panels and collapses the rail
   - Race HUD lives as a **map overlay** so collapsing the sidebar never hides controls
   - Opening texture packs while a route is open must **show the pack UI** (not leave the route panel lit while packs looks selected)
4. **Mobile first for controls**
   - Large touch pads; no dependency on WASD alone

## Out of scope for first ship of this vision

- Multiplayer
- Real physics engine / multiplayer cars
- Photoreal street-view panoramas (unless Apple provides a supported API we can license)

## Phased delivery

| Phase | Goal |
|-------|------|
| **A — UI exclusivity** | ✅ Packs/route panel mismatch fixed; race HUD on map overlay; pack pick closes panel |
| **B — Immersive camera** | ✅ Street-level pitch/bearing follow on MapLibre + Apple web + iOS |
| **C — Car presentation** | ✅ Improved 3D-ish CSS car on MapLibre; Apple/iOS car annotations upgraded |
| **D — Pack + Apple parity** | ✅ Shared race session + chase cam on both web renderers + native |
| **E — Polish** | ⬜ Minimap, countdown, true 3D mesh cars, haptics, multiplayer |
| **F — Web↔iOS parity** | ✅ P0 shipped (`0340ad5`): iOS game physics + overlay HUD; web Apple TBT + search-area; run history; see improvement plan for P1/P2 remainder |

## Bugfix pass (post ship)

- [x] Car-only race session (bike/foot no longer arm the HUD)
- [x] Pause/finish preserve game physics progress (no teleport)
- [x] Race-again reset after finished (web + iOS)
- [x] Lateral steering applied to car marker on MapLibre + Apple web
- [x] Car visible at start line (ready) and finish on web + iOS
- [x] Completed runs always persisted to localStorage
- [x] Immersive rail collapse through finished state

## Acceptance checks

- [x] With a car route open, open texture packs → pack list is actually visible
- [x] Select a pack → panel closes, route still available
- [x] Start race → rail collapses, HUD stays on map, map follows car at street pitch
- [x] Works on phone width with touch pads
- [x] Apple and custom packs both show follow-cam race (web)
- [x] iOS chase cam during race (Apple + custom MapLibre screens)

