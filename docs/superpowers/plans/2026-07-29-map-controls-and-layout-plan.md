# mAiity Map Controls and Layout Implementation Plan

1. Reproduce Apple OAuth failure from production logs and callback state.
2. Add regression tests for the identified OAuth failure.
3. Introduce a web map command adapter implemented by MapLibre and MapKit JS.
4. Persist desktop sidebar state and build the collapsed full-width toolbar.
5. Extract search results from the search control into a reusable anchored
   result surface.
6. Add native Apple zoom controls and align all native provider controls.
7. Reorder native search results outside the search section.
8. Run server tests, web build, and native build.
9. Commit, push, deploy web/API, install on iPhone, and verify live behavior.
10. Refresh and publish CodeGraph.
