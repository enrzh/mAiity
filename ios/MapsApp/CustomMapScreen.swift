import CoreLocation
import MapKit
import MapLibre
import MapLibreSwiftDSL
import MapLibreSwiftUI
import SwiftUI
import UIKit

/// Shared-style renderer for every non-Apple pack.
struct CustomMapScreen: View {
    var sheetHeight: CGFloat

    @EnvironmentObject private var model: AppModel
    @ObservedObject private var location = LocationService.shared
    @State private var camera = MapViewCamera.center(
        CLLocationCoordinate2D(latitude: 51.19297, longitude: 6.71375), zoom: 13
    )
    @State private var is3D = false
    @State private var lastCenter = CLLocationCoordinate2D(latitude: 51.19297, longitude: 6.71375)
    @State private var currentZoom: Double = 13

    var body: some View {
        Group {
            if let styleURL = model.styleURL {
                map(styleURL)
            } else if model.bootFailed {
                ContentUnavailableView(
                    L.t("map-load-failed"),
                    systemImage: "wifi.exclamationmark",
                    description: Text(L.t("retry"))
                )
            } else {
                ProgressView().task { await model.boot() }
            }
        }
    }

    private func map(_ styleURL: URL) -> some View {
        MapView(styleURL: styleURL, camera: $camera) {
            LineStyleLayer(identifier: "route-line", source: routeSource)
                .lineCap(.round)
                .lineJoin(.round)
                .lineColor(MapTokens.route)
                .lineWidth(MapTokens.routeWidth)
            CircleStyleLayer(identifier: "pois", source: poiSource)
                .radius(MapTokens.poiRadius)
                .color(MapTokens.poi)
                .strokeWidth(MapTokens.poiStrokeWidth)
                .strokeColor(MapTokens.markerStroke)
            CircleStyleLayer(identifier: "bookmarks", source: bookmarkSource)
                .radius(MapTokens.bookmarkRadius)
                .color(MapTokens.bookmark)
                .strokeWidth(MapTokens.bookmarkStrokeWidth)
                .strokeColor(MapTokens.markerStroke)
            CircleStyleLayer(identifier: "selected", source: selectedSource)
                .radius(MapTokens.selectedRadius)
                .color(MapTokens.selected)
                .strokeWidth(MapTokens.selectedStrokeWidth)
                .strokeColor(MapTokens.markerStroke)
            CircleStyleLayer(identifier: "driving-car", source: drivingSource)
                .radius(10)
                .color(.blue)
                .strokeWidth(3)
                .strokeColor(.white)
        }
        .unsafeMapViewControllerModifier { controller in
            let wanted = location.isAuthorized
            if controller.mapView.showsUserLocation != wanted {
                controller.mapView.showsUserLocation = wanted
            }
        }
        .onTapMapGesture { context in
            let c = context.coordinate
            Task { await model.selectTap(lat: c.latitude, lon: c.longitude) }
        }
        .ignoresSafeArea()
        .overlay(alignment: .bottomTrailing) {
            VStack(spacing: 10) {
                mapButton(
                    symbol: "paintpalette.fill",
                    label: L.t("map-style")
                ) { model.showPackPicker = true }

                mapButton(
                    symbol: is3D ? "cube.fill" : "cube",
                    label: L.t("view-3d")
                ) {
                    is3D.toggle()
                    camera = .center(
                        lastCenter,
                        zoom: is3D ? 16 : 14,
                        pitch: is3D ? 60 : 0,
                        direction: is3D ? 20 : 0
                    )
                }

                mapButton(
                    symbol: location.isAuthorized ? "location.fill" : "location",
                    label: L.t("my-location")
                ) {
                    location.onAuthorized = { camera = .trackUserLocation(zoom: 15) }
                    location.requestOrTrack()
                }

                // Zoom stack matches Apple MapScreen (44pt targets).
                VStack(spacing: 0) {
                    Button {
                        camera = .center(lastCenter, zoom: min(20, currentZoom + 1), pitch: is3D ? 60 : 0)
                    } label: {
                        Image(systemName: "plus").frame(width: 44, height: 44)
                    }
                    Divider().padding(.horizontal, 8)
                    Button {
                        camera = .center(lastCenter, zoom: max(2, currentZoom - 1), pitch: is3D ? 60 : 0)
                    } label: {
                        Image(systemName: "minus").frame(width: 44, height: 44)
                    }
                }
                .buttonStyle(.plain)
                .frame(width: 44, height: 89)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22))
                .fixedSize()
                .accessibilityElement(children: .contain)
            }
            .padding(.trailing, 14)
            .padding(.bottom, sheetHeight + 16)
        }
        .onChange(of: model.cameraTarget) { _, target in
            guard let target else { return }
            move(to: target.place, zoom: 15)
        }
        .onChange(of: model.startupLocation) { _, target in
            guard let target else { return }
            move(to: target.place, zoom: 14)
        }
        .onChange(of: model.navCamera) { _, target in
            guard let target else { return }
            lastCenter = target.center
            let racing: Bool = {
                switch model.driving {
                case .ready, .running, .paused, .finished: return true
                default: return false
                }
            }()
            // Street-level race: higher pitch/zoom so pack buildings fill the view.
            let reduceMotion = UIAccessibility.isReduceMotionEnabled
            let z = racing ? 17.6 : 17.0
            currentZoom = z
            camera = .center(
                target.center,
                zoom: z,
                pitch: reduceMotion ? (racing ? 40 : 0) : (racing ? 68 : 60),
                direction: target.heading
            )
            model.noteMapRegion(MKCoordinateRegion(
                center: target.center,
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            ))
        }
    }

    private func move(to place: Place, zoom: Double) {
        let center = CLLocationCoordinate2D(latitude: place.lat, longitude: place.lon)
        lastCenter = center
        currentZoom = zoom
        camera = .center(center, zoom: zoom, pitch: is3D ? 60 : 0)
    }

    private func mapButton(symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 44, height: 44)
                .background(.regularMaterial, in: Circle())
        }
        .accessibilityLabel(label)
    }

    private var bookmarkSource: ShapeSource {
        ShapeSource(identifier: "bookmark-source") {
            for item in model.bookmarks {
                MLNPointFeature(coordinate: coordinate(item.lat, item.lon))
            }
        }
    }

    private var poiSource: ShapeSource {
        ShapeSource(identifier: "poi-source") {
            for item in model.pois {
                MLNPointFeature(coordinate: coordinate(item.lat, item.lon))
            }
        }
    }

    private var selectedSource: ShapeSource {
        ShapeSource(identifier: "selected-source") {
            if let item = model.selected {
                MLNPointFeature(coordinate: coordinate(item.lat, item.lon))
            }
        }
    }

    private var routeSource: ShapeSource {
        ShapeSource(identifier: "route-source") {
            if let geometry = model.route?.result?.geometry, geometry.count > 1 {
                let points = geometry.map { coordinate($0[1], $0[0]) }
                MLNPolylineFeature(coordinates: points, count: UInt(points.count))
            }
        }
    }

    private var drivingSource: ShapeSource {
        ShapeSource(identifier: "driving-source") {
            // Show car from ready (start line) through finished — not only mid-run.
            let active: Bool = {
                switch model.driving {
                case .idle: return false
                default: return true
                }
            }()
            if active, let geometry = model.route?.result?.geometry, geometry.count > 1 {
                let car = DrivingPhysics.carPosition(
                    progress: model.driving.progress,
                    lateral: model.raceLateral,
                    geometry: geometry
                )
                MLNPointFeature(coordinate: coordinate(car.lat, car.lon))
            }
        }
    }

    private func coordinate(_ lat: Double, _ lon: Double) -> CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}
