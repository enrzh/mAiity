import SwiftUI
import CoreLocation
import MapLibre
import MapLibreSwiftDSL
import MapLibreSwiftUI

/// Full-screen MapLibre map. Style = the active pack's style.json (same file
/// the web renders). Selected place + bookmarks are GPU style layers, re-added
/// automatically after pack switches.
struct MapScreen: View {
    /// Current bottom-sheet height — the floating controls ride just above it.
    var sheetHeight: CGFloat = 96

    @EnvironmentObject private var model: AppModel
    @ObservedObject private var location = LocationService.shared
    @State private var camera = MapViewCamera.center(
        CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45), zoom: 5.5
    )
    @State private var is3D = false
    /// Last known map centre, so the 3D toggle can re-frame in place.
    @State private var lastCenter = CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45)

    var body: some View {
        if let styleURL = model.styleURL {
            MapView(styleURL: styleURL, camera: $camera) {
                // NOTE: no custom user dot — MapLibre already draws the
                // system location puck (with accuracy halo and heading) once
                // the camera tracks the user. Adding our own showed TWO dots.
                // Active route (blue line under the markers).
                LineStyleLayer(identifier: "route-line", source: routeSource)
                    .lineCap(.round)
                    .lineJoin(.round)
                    .lineColor(MapTokens.route)
                    .lineWidth(MapTokens.routeWidth)
                // POI category results (teal).
                CircleStyleLayer(identifier: "pois", source: poiSource)
                    .radius(MapTokens.poiRadius)
                    .color(MapTokens.poi)
                    .strokeWidth(MapTokens.poiStrokeWidth)
                    .strokeColor(MapTokens.markerStroke)
                // Saved places (gold).
                CircleStyleLayer(identifier: "bookmarks", source: bookmarkSource)
                    .radius(MapTokens.bookmarkRadius)
                    .color(MapTokens.bookmark)
                    .strokeWidth(MapTokens.bookmarkStrokeWidth)
                    .strokeColor(MapTokens.markerStroke)
                // Selected place (red, on top). Bigger AND a wider white ring
                // than the rest — colour is not the only differentiator.
                CircleStyleLayer(identifier: "selected", source: selectedSource)
                    .radius(MapTokens.selectedRadius)
                    .color(MapTokens.selected)
                    .strokeWidth(MapTokens.selectedStrokeWidth)
                    .strokeColor(MapTokens.markerStroke)
            }
            // Localize base-map labels to the UI language once the style is in.
            .onMapStyleLoaded { style in
                Self.applyLabelLanguage(style, lang: model.lang)
            }
            // Show the NATIVE location puck (halo + heading) as soon as we're
            // authorized. Without this the puck only appears once the camera
            // enters .trackUserLocation (i.e. after tapping locate), because
            // that's the only path that sets userTrackingMode ≠ .none.
            // The closure runs on EVERY updateUIView, so only assign on change.
            .unsafeMapViewControllerModifier { controller in
                let wanted = location.isAuthorized
                if controller.mapView.showsUserLocation != wanted {
                    controller.mapView.showsUserLocation = wanted
                }
                // Re-apply label language when it changes (this closure runs
                // on every SwiftUI update; the helper only writes on change).
                if let style = controller.mapView.style {
                    Self.applyLabelLanguage(style, lang: model.lang)
                }
            }
            .onTapMapGesture { context in
                let c = context.coordinate
                Task { await model.selectTap(lat: c.latitude, lon: c.longitude) }
            }
            .ignoresSafeArea()
            // Floating controls sit at the BOTTOM-RIGHT, directly above the
            // sheet, and animate with it as the user drags between detents.
            .overlay(alignment: .bottomTrailing) {
                VStack(spacing: 10) {
                    mapButton(
                        symbol: model.activePackId == "light" ? "paintpalette" : "paintpalette.fill",
                        label: L.t("map-style")
                    ) { model.showPackPicker = true }

                    mapButton(symbol: is3D ? "cube.fill" : "cube", label: L.t("view-3d")) {
                        is3D.toggle()
                        camera = .center(lastCenter, zoom: is3D ? 16 : 14,
                                         pitch: is3D ? 60 : 0,
                                         direction: is3D ? 20 : 0)
                    }

                    mapButton(
                        symbol: location.isAuthorized ? "location.fill" : "location",
                        label: L.t("my-location")
                    ) {
                        location.onAuthorized = { camera = .trackUserLocation(zoom: 15) }
                        location.requestOrTrack()
                    }
                }
                .padding(.trailing, 14)
                .padding(.bottom, sheetHeight + 16)
                .animation(.interactiveSpring(response: 0.35, dampingFraction: 0.85), value: sheetHeight)
            }
            .onChange(of: model.cameraTarget) { target in
                guard let target else { return }
                let c = CLLocationCoordinate2D(latitude: target.place.lat, longitude: target.place.lon)
                lastCenter = c
                camera = .center(c, zoom: 15, pitch: is3D ? 60 : 0)
            }
            .onChange(of: model.navCamera) { cam in
                // Turn-by-turn: ride behind the user, facing travel direction.
                guard let cam else { return }
                lastCenter = cam.center
                camera = .center(cam.center, zoom: 17, pitch: 60, direction: cam.heading)
            }
            .onChange(of: model.startupLocation) { start in
                guard let start else { return }
                let c = CLLocationCoordinate2D(latitude: start.place.lat, longitude: start.place.lon)
                lastCenter = c
                camera = .center(c, zoom: 14)
            }
            .onChange(of: model.pois) { pois in
                // Frame the POI result set.
                guard pois.count > 1 else { return }
                var minLat = 90.0, maxLat = -90.0, minLon = 180.0, maxLon = -180.0
                for p in pois {
                    minLat = min(minLat, p.lat); maxLat = max(maxLat, p.lat)
                    minLon = min(minLon, p.lon); maxLon = max(maxLon, p.lon)
                }
                let bounds = MLNCoordinateBounds(
                    sw: CLLocationCoordinate2D(latitude: minLat, longitude: minLon),
                    ne: CLLocationCoordinate2D(latitude: maxLat, longitude: maxLon)
                )
                camera = .boundingBox(bounds, edgePadding: UIEdgeInsets(top: 80, left: 40, bottom: 260, right: 40))
            }
            .onChange(of: model.route) { route in
                // Fit the whole route once it's computed.
                guard let geo = route?.result?.geometry, geo.count > 1,
                      route?.status == .ready else { return }
                var minLat = 90.0, maxLat = -90.0, minLon = 180.0, maxLon = -180.0
                for p in geo {
                    minLon = min(minLon, p[0]); maxLon = max(maxLon, p[0])
                    minLat = min(minLat, p[1]); maxLat = max(maxLat, p[1])
                }
                let bounds = MLNCoordinateBounds(
                    sw: CLLocationCoordinate2D(latitude: minLat, longitude: minLon),
                    ne: CLLocationCoordinate2D(latitude: maxLat, longitude: maxLon)
                )
                camera = .boundingBox(bounds, edgePadding: UIEdgeInsets(top: 80, left: 40, bottom: 280, right: 40))
            }
        } else if model.bootFailed {
            // First launch without connectivity — a spinner forever helps nobody.
            VStack(spacing: 14) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.largeTitle).foregroundStyle(.secondary)
                Text(L.t("map-load-failed"))
                    .font(.subheadline).foregroundStyle(.secondary)
                Button(L.t("retry")) {
                    Task { await model.boot() }
                }
                .buttonStyle(.borderedProminent)
            }
        } else {
            ProgressView().task { await model.boot() }
        }
    }

    /// Point base-map labels at `name:<lang>` with a `name` fallback, same as
    /// the web app. Only writes when the expression actually changes so the
    /// per-update call from unsafeMapViewControllerModifier stays cheap.
    static func applyLabelLanguage(_ style: MLNStyle, lang: String) {
        let localized = NSExpression(
            format: "mgl_coalesce({%@, %@})",
            NSExpression(forKeyPath: "name:\(lang)"),
            NSExpression(forKeyPath: "name")
        )
        if let places = style.layer(withIdentifier: "places-labels") as? MLNSymbolStyleLayer,
           places.text != localized {
            places.text = localized
        }
        // Landmarks carry a "✦ " prefix in the shared style — preserve it by
        // joining the prefix with the localized name.
        let landmarkText = NSExpression(
            format: "mgl_join({%@, %@})",
            NSExpression(forConstantValue: "✦ "),
            localized
        )
        if let landmarks = style.layer(withIdentifier: "landmarks-labels") as? MLNSymbolStyleLayer,
           landmarks.text != landmarkText {
            landmarks.text = landmarkText
        }
    }

    private var bookmarkSource: ShapeSource {
        ShapeSource(identifier: "bookmark-source") {
            for b in model.bookmarks {
                MLNPointFeature(coordinate: CLLocationCoordinate2D(latitude: b.lat, longitude: b.lon))
            }
        }
    }

    private var selectedSource: ShapeSource {
        ShapeSource(identifier: "selected-source") {
            if let s = model.selected {
                MLNPointFeature(coordinate: CLLocationCoordinate2D(latitude: s.lat, longitude: s.lon))
            }
        }
    }

    /// Consistent circular control used by the floating map buttons.
    private func mapButton(symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: Circle())
                .shadow(color: .black.opacity(0.18), radius: 5, y: 2)
        }
        .accessibilityLabel(label)
    }

    private var poiSource: ShapeSource {
        ShapeSource(identifier: "poi-source") {
            for p in model.pois {
                MLNPointFeature(coordinate: CLLocationCoordinate2D(latitude: p.lat, longitude: p.lon))
            }
        }
    }

    private var routeSource: ShapeSource {
        ShapeSource(identifier: "route-source") {
            if let geo = model.route?.result?.geometry, geo.count > 1 {
                let coords = geo.map { CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0]) }
                MLNPolylineFeature(coordinates: coords, count: UInt(coords.count))
            }
        }
    }
}
