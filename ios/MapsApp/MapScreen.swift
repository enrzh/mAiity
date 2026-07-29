import CoreLocation
import MapKit
import SwiftUI

/// Apple Maps is the default renderer. Real custom styles keep using the
/// shared MapLibre style files instead of being approximated with map types.
struct MapScreen: View {
    var sheetHeight: CGFloat = 96

    @EnvironmentObject private var model: AppModel
    @ObservedObject private var location = LocationService.shared
    @Namespace private var mapScope
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45),
            span: MKCoordinateSpan(latitudeDelta: 8.0, longitudeDelta: 11.0)
        )
    )

    var body: some View {
        if model.activePackId == "light" {
            appleMap
        } else {
            CustomMapScreen(sheetHeight: sheetHeight)
        }
    }

    private var appleMap: some View {
        Map(position: $position) {
            if location.isAuthorized {
                UserAnnotation()
            }

            ForEach(model.pois) { place in
                Marker(place.name, coordinate: coordinate(place.lat, place.lon))
                    .tint(.teal)
            }

            ForEach(model.bookmarks) { bookmark in
                Marker(bookmark.name, coordinate: coordinate(bookmark.lat, bookmark.lon))
                    .tint(.yellow)
            }

            if let selected = model.selected {
                Marker(selected.name, coordinate: coordinate(selected.lat, selected.lon))
                    .tint(.red)
            }

            if let geometry = model.route?.result?.geometry, geometry.count > 1 {
                MapPolyline(coordinates: geometry.map { coordinate($0[1], $0[0]) })
                    .stroke(.blue, lineWidth: 6)
            }
        }
        .mapStyle(selectedMapStyle)
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
            model.mapCenter = context.region.center
        }
        .onChange(of: model.selected) { _, place in
            guard let place else { return }
            position = .region(regionAround(place.lat, place.lon, span: 0.08))
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
            position = .camera(MapCamera(
                centerCoordinate: camera.center,
                distance: 900,
                heading: camera.heading,
                pitch: 55
            ))
        }
        .overlay(alignment: .bottomTrailing) {
            VStack(spacing: 10) {
                Button {
                    model.showPackPicker = true
                } label: {
                    Image(systemName: "paintpalette")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(width: 44, height: 44)
                        .background(.regularMaterial, in: Circle())
                }
                .accessibilityLabel(L.t("map-style"))

                MapPitchToggle(scope: mapScope)
                    .frame(width: 44, height: 44)
                    .background(.regularMaterial, in: Circle())

                MapUserLocationButton(scope: mapScope)
                    .frame(width: 44, height: 44)
                    .background(.regularMaterial, in: Circle())
            }
            .padding(.trailing, 14)
            .padding(.bottom, sheetHeight + 16)
        }
    }

    private var selectedMapStyle: MapStyle { .standard(elevation: .realistic) }

    private func coordinate(_ lat: Double, _ lon: Double) -> CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    private func regionAround(_ lat: Double, _ lon: Double, span: Double) -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: coordinate(lat, lon),
            span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
        )
    }
}
