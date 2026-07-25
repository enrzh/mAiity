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
                // "You are here" dot — always visible once authorized, like
                // the platform maps (not only after tapping locate).
                CircleStyleLayer(identifier: "user-dot", source: userSource)
                    .radius(7)
                    .color(UIColor(red: 0.10, green: 0.45, blue: 0.91, alpha: 1))
                    .strokeWidth(3)
                    .strokeColor(.white)
                // Active route (blue line under the markers).
                LineStyleLayer(identifier: "route-line", source: routeSource)
                    .lineCap(.round)
                    .lineJoin(.round)
                    .lineColor(UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1))
                    .lineWidth(5)
                // POI category results (teal).
                CircleStyleLayer(identifier: "pois", source: poiSource)
                    .radius(6)
                    .color(UIColor(red: 0.05, green: 0.58, blue: 0.53, alpha: 1))
                    .strokeWidth(1.5)
                    .strokeColor(.white)
                // Saved places (gold).
                CircleStyleLayer(identifier: "bookmarks", source: bookmarkSource)
                    .radius(7)
                    .color(UIColor(red: 0.95, green: 0.77, blue: 0.06, alpha: 1))
                    .strokeWidth(2)
                    .strokeColor(.white)
                // Selected place (red, on top).
                CircleStyleLayer(identifier: "selected", source: selectedSource)
                    .radius(9)
                    .color(UIColor(red: 0.91, green: 0.30, blue: 0.24, alpha: 1))
                    .strokeWidth(2.5)
                    .strokeColor(.white)
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
                        label: "Karten-Stil"
                    ) { model.showPackPicker = true }

                    mapButton(symbol: is3D ? "cube.fill" : "cube", label: "3D-Ansicht") {
                        is3D.toggle()
                        camera = .center(lastCenter, zoom: is3D ? 16 : 14,
                                         pitch: is3D ? 60 : 0,
                                         direction: is3D ? 20 : 0)
                    }

                    mapButton(
                        symbol: location.isAuthorized ? "location.fill" : "location",
                        label: "Mein Standort"
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
                Text("Karte konnte nicht geladen werden.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button("Erneut versuchen") {
                    Task { await model.boot() }
                }
                .buttonStyle(.borderedProminent)
            }
        } else {
            ProgressView().task { await model.boot() }
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

    private var userSource: ShapeSource {
        ShapeSource(identifier: "user-source") {
            if let u = model.startupLocation {
                MLNPointFeature(coordinate: CLLocationCoordinate2D(latitude: u.place.lat, longitude: u.place.lon))
            }
        }
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
