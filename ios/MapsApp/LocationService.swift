import CoreLocation
import UIKit

/// Owns the CLLocationManager + permission flow. The map switches to a
/// user-tracking camera once (and whenever) authorization is granted.
@MainActor
final class LocationService: NSObject, ObservableObject {
    static let shared = LocationService()

    @Published var status: CLAuthorizationStatus = .notDetermined
    private let manager = CLLocationManager()
    /// Called on the main actor when tracking may start.
    var onAuthorized: (() -> Void)?
    private var locationWaiters: [CheckedContinuation<CLLocationCoordinate2D?, Never>] = []

    override init() {
        super.init()
        manager.delegate = self
        status = manager.authorizationStatus
    }

    /// One-shot current position (for routing). Nil when denied/unavailable.
    func currentLocation() async -> CLLocationCoordinate2D? {
        if let cached = manager.location,
           cached.timestamp.timeIntervalSinceNow > -60 {
            return cached.coordinate
        }
        if status == .notDetermined { manager.requestWhenInUseAuthorization() }
        if status == .denied || status == .restricted { return nil }
        return await withCheckedContinuation { cont in
            locationWaiters.append(cont)
            manager.requestLocation()
        }
    }

    private func resolveWaiters(_ coord: CLLocationCoordinate2D?) {
        let waiters = locationWaiters
        locationWaiters = []
        for w in waiters { w.resume(returning: coord) }
    }

    /// Locate-me button behavior: ask when undecided, track when allowed,
    /// deep-link to Settings when the user previously denied.
    func requestOrTrack() {
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            onAuthorized?()
        case .denied, .restricted:
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        @unknown default:
            break
        }
    }

    var isAuthorized: Bool {
        status == .authorizedWhenInUse || status == .authorizedAlways
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let s = manager.authorizationStatus
        Task { @MainActor in
            self.status = s
            if s == .authorizedWhenInUse || s == .authorizedAlways {
                self.onAuthorized?()
            } else if s == .denied || s == .restricted {
                self.resolveWaiters(nil)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let coord = locations.last?.coordinate
        Task { @MainActor in self.resolveWaiters(coord) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.resolveWaiters(nil) }
    }
}
