import CoreLocation
import MapKit
import SwiftUI
import UIKit

/// Apple Maps is the default renderer. Real custom styles keep using the
/// shared MapLibre style files instead of being approximated with map types.
struct MapScreen: View {
    var sheetHeight: CGFloat = 96

    @EnvironmentObject private var model: AppModel
    @ObservedObject private var location = LocationService.shared
    @Namespace private var mapScope
    @State private var position: MapCameraPosition = .region(
        MapPersistence.readViewport(provider: "apple")?.region
            ?? MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45),
                span: MKCoordinateSpan(latitudeDelta: 8.0, longitudeDelta: 11.0)
            )
    )
    @State private var visibleRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45),
        span: MKCoordinateSpan(latitudeDelta: 8.0, longitudeDelta: 11.0)
    )
    @State private var is3D = false
    @State private var selectedMarkerID: String?

    var body: some View {
        if model.activePackId == "light" {
            appleMap
        } else {
            CustomMapScreen(sheetHeight: sheetHeight)
        }
    }

    private var appleMap: some View {
        MapReader { proxy in
            Map(position: $position, selection: $selectedMarkerID) {
                if location.isAuthorized {
                    UserAnnotation()
                }

                ForEach(model.pois) { place in
                    Marker(place.name, coordinate: coordinate(place.lat, place.lon))
                        .tint(.teal)
                        .tag("poi:\(place.id)")
                }

                ForEach(model.bookmarks) { bookmark in
                    Marker(bookmark.name, coordinate: coordinate(bookmark.lat, bookmark.lon))
                        .tint(.yellow)
                        .tag("bookmark:\(bookmark.id)")
                }

                if let selected = model.selected {
                    Marker(selected.name, coordinate: coordinate(selected.lat, selected.lon))
                        .tint(.red)
                        .tag("selected")
                }

                if let geometry = model.route?.result?.geometry, geometry.count > 1 {
                    MapPolyline(coordinates: geometry.map { coordinate($0[1], $0[0]) })
                        .stroke(.blue, lineWidth: 6)
                }

                if let car = drivingCoordinate {
                    Annotation("Driving position", coordinate: car) {
                        Image(systemName: "car.fill")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .padding(8)
                            .background(.blue, in: Circle())
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                    }
                }
            }
            .mapStyle(selectedMapStyle)
            .preferredColorScheme(preferredMapColorScheme)
            .mapScope(mapScope)
            .mapControls {
                MapCompass(scope: mapScope)
                MapScaleView(scope: mapScope)
            }
            .safeAreaInset(edge: .bottom) {
                Color.clear.frame(height: sheetHeight)
            }
            .ignoresSafeArea()
            .onMapCameraChange(frequency: .onEnd) { context in
                // Keep route/category searches anchored to the actual Apple map.
                visibleRegion = context.region
                model.mapCenter = context.region.center
                model.noteMapRegion(context.region)
            }
            .gesture(
                SpatialTapGesture().onEnded { event in
                    // Empty-map reverse-geocode (parity with custom MapLibre).
                    if let coord = proxy.convert(event.location, from: .local) {
                        Task { await model.selectTap(lat: coord.latitude, lon: coord.longitude) }
                    }
                }
            )
        }
        .onChange(of: model.selected) { _, place in
            guard let place else { return }
            position = .region(regionAround(place.lat, place.lon, span: 0.08))
        }
        .onChange(of: selectedMarkerID) { _, markerID in
            guard let markerID else { return }
            if markerID.hasPrefix("poi:") {
                let id = String(markerID.dropFirst(4))
                if let place = model.pois.first(where: { $0.id == id }) {
                    model.select(result: place)
                }
            } else if markerID.hasPrefix("bookmark:") {
                let id = String(markerID.dropFirst(9))
                if let bookmark = model.bookmarks.first(where: { $0.id == id }) {
                    model.selected = Place(
                        name: bookmark.name,
                        label: bookmark.note,
                        lat: bookmark.lat,
                        lon: bookmark.lon
                    )
                }
            }
        }
        .onChange(of: model.cameraTarget) { _, target in
            guard let place = target?.place else { return }
            position = .region(regionAround(place.lat, place.lon, span: 0.08))
        }
        .onChange(of: model.startupLocation) { _, start in
            guard let place = start?.place else { return }
            position = .region(regionAround(place.lat, place.lon, span: 0.08))
        }
        .onChange(of: model.navCamera) { _, camera in
            guard let camera else { return }
            // Race mode uses a tighter street-level chase cam; turn-by-turn stays wider.
            let racing: Bool = {
                switch model.driving {
                case .ready, .running, .paused, .finished: return true
                default: return false
                }
            }()
            let reduceMotion = UIAccessibility.isReduceMotionEnabled
            position = .camera(MapCamera(
                centerCoordinate: camera.center,
                distance: racing ? 280 : 900,
                heading: camera.heading,
                pitch: reduceMotion ? (racing ? 45 : 0) : (racing ? 68 : 55)
            ))
        }
        .overlay(alignment: .bottomTrailing) {
            VStack(spacing: 10) {
                mapButton("paintpalette") { model.showPackPicker = true }
                .accessibilityLabel(L.t("map-style"))

                mapButton(is3D ? "view.2d" : "view.3d") { toggle3D() }
                    .accessibilityLabel(L.t("view-3d"))

                mapButton("location.fill") { locate() }
                    .accessibilityLabel(L.t("my-location"))

                VStack(spacing: 0) {
                    Button { zoom(by: 0.55) } label: {
                        Image(systemName: "plus").frame(width: 44, height: 44)
                    }
                    Divider().padding(.horizontal, 8)
                    Button { zoom(by: 1.8) } label: {
                        Image(systemName: "minus").frame(width: 44, height: 44)
                    }
                }
                .buttonStyle(.plain)
                .frame(width: 44, height: 89)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
                .fixedSize()
            }
            .padding(.trailing, 14)
            .padding(.bottom, sheetHeight + 16)
        }
    }

    private var selectedMapStyle: MapStyle {
        switch model.appleMapType {
        case "satellite":
            return .imagery(elevation: .realistic)
        case "hybrid":
            return .hybrid(elevation: .realistic)
        default:
            return .standard(elevation: .realistic)
        }
    }

    private var preferredMapColorScheme: ColorScheme? {
        switch model.appleColorScheme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    private func coordinate(_ lat: Double, _ lon: Double) -> CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private var drivingCoordinate: CLLocationCoordinate2D? {
        // Show car from ready (start line) through finished — not only mid-run.
        switch model.driving {
        case .idle: return nil
        default: break
        }
        guard let geometry = model.route?.result?.geometry, geometry.count > 1 else { return nil }
        let car = DrivingPhysics.carPosition(
            progress: model.driving.progress,
            lateral: model.raceLateral,
            geometry: geometry
        )
        return coordinate(car.lat, car.lon)
    }

    private func regionAround(_ lat: Double, _ lon: Double, span: Double) -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: coordinate(lat, lon),
            span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
        )
    }

    private func zoom(by factor: Double) {
        let region = MKCoordinateRegion(
            center: visibleRegion.center,
            span: MKCoordinateSpan(
                latitudeDelta: max(0.0008, min(160, visibleRegion.span.latitudeDelta * factor)),
                longitudeDelta: max(0.0008, min(320, visibleRegion.span.longitudeDelta * factor))
            )
        )
        visibleRegion = region
        position = .region(region)
    }

    private func toggle3D() {
        is3D.toggle()
        if is3D {
            position = .camera(MapCamera(
                centerCoordinate: visibleRegion.center,
                distance: max(650, visibleRegion.span.latitudeDelta * 90_000),
                heading: -18,
                pitch: 58
            ))
        } else {
            position = .region(visibleRegion)
        }
    }

    private func locate() {
        Task {
            guard let coordinate = await location.currentLocation() else { return }
            let region = MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.025, longitudeDelta: 0.025)
            )
            visibleRegion = region
            position = .region(region)
        }
    }

    private func mapButton(_ systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .frame(width: 44, height: 44)
        .background(.regularMaterial, in: Circle())
        .fixedSize()
    }
}
