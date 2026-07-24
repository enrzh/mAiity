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
    /// IMPORTANT: never issue requestLocation() before authorization resolves —
    /// CoreLocation fails a pre-grant request with kCLErrorDenied while the
    /// permission prompt is still on screen (empirically verified), which
    /// would resolve the waiter nil even though the user then grants.
    func currentLocation() async -> CLLocationCoordinate2D? {
        if let cached = manager.location,
           cached.timestamp.timeIntervalSinceNow > -60 {
            return cached.coordinate
        }
        switch status {
        case .denied, .restricted:
            return nil
        case .notDetermined:
            // Defer the location request to didChangeAuthorization.
            return await withCheckedContinuation { cont in
                locationWaiters.append(cont)
                manager.requestWhenInUseAuthorization()
            }
        default:
            return await withCheckedContinuation { cont in
                locationWaiters.append(cont)
                manager.requestLocation()
            }
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
                // Grant arrived — now issue the real request for anyone waiting.
                if !self.locationWaiters.isEmpty {
                    self.manager.requestLocation()
                }
            } else {
                // .denied/.restricted, or .notDetermined again (prompt was
                // dismissed without a decision) — nothing will ever arrive.
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
