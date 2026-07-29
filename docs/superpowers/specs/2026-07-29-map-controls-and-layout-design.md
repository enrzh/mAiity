# mAiity Map Controls and Layout Design

## Goal

Make Apple Maps and custom map styles behave consistently across web and iOS,
fix Apple web sign-in, preserve the desktop sidebar state, and keep search
results independent from the search control.

## Architecture

Map commands use a renderer-neutral control contract. MapLibre, MapKit JS, and
native MapKit each implement location, zoom, and 3D/pitch using their supported
camera APIs. Shared UI invokes the contract and does not inspect provider
internals.

## Web Layout

- Store the desktop sidebar collapsed state in local storage.
- Expanded mode retains the left rail.
- Collapsed mode exposes search, category shortcuts, and rail actions in a
  full-width top toolbar.
- Search results render in a separate anchored surface below the search input.
- Mobile keeps its sheet model, but results remain visually separate from the
  search control.

## Web Map Controls

- Keep one application-owned control stack for location, 3D/pitch, and zoom.
- MapKit JS receives equivalent camera commands through its provider adapter.
- Keep Apple's map-type control because it exposes Apple-specific imagery
  choices; hide duplicate Apple controls where the app owns the same action.
- Location permission errors produce visible feedback instead of silent no-ops.

## Native Map Controls

- Native Apple Map keeps `MapPitchToggle` and `MapUserLocationButton`.
- Add native zoom controls and align all map actions with the style control in
  one safe-area-aware bottom-right stack.
- Custom MapLibre mode uses the same visual order and touch dimensions.
- Search results render above the search section as their own list content.

## Apple Authentication

- Diagnose the production callback exchange and configuration.
- Keep state validation and HttpOnly session cookies.
- Return a stable user-facing failure reason while logging actionable
  server-side diagnostics without exposing secrets.

## Testing

- Unit tests cover persisted sidebar state and renderer command dispatch.
- API tests cover successful and failed Apple OAuth callback exchange.
- Existing server and web builds remain green.
- Browser verification checks Apple sign-in routing, toolbar states, map
  location/zoom/pitch commands, and Apple tile loading.
- Native build is installed on the connected iPhone and launched.

