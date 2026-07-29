import Foundation
import CoreLocation
import MapKit

/// Versioned map preferences + viewport, mirroring web `providerPreferences.ts`
/// and `viewportStorage.ts`.
struct MapPreferences: Codable, Equatable {
    var version: Int
    var provider: String // "apple" | "custom"
    var customPackId: String
    var appleMapType: String
    var appleColorScheme: String

    static let `default` = MapPreferences(
        version: 1,
        provider: "apple",
        customPackId: "dark",
        appleMapType: "standard",
        appleColorScheme: "adaptive"
    )
}

struct SavedViewport: Codable, Equatable {
    var lat: Double
    var lon: Double
    var latitudeDelta: Double
    var longitudeDelta: Double

    var region: MKCoordinateRegion {
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: lat, longitude: lon),
            span: MKCoordinateSpan(latitudeDelta: latitudeDelta, longitudeDelta: longitudeDelta)
        )
    }

    init(region: MKCoordinateRegion) {
        lat = region.center.latitude
        lon = region.center.longitude
        latitudeDelta = region.span.latitudeDelta
        longitudeDelta = region.span.longitudeDelta
    }

    init(lat: Double, lon: Double, latitudeDelta: Double, longitudeDelta: Double) {
        self.lat = lat
        self.lon = lon
        self.latitudeDelta = latitudeDelta
        self.longitudeDelta = longitudeDelta
    }
}

enum MapPersistence {
    private static let prefsKey = "maps.preferences.v1"
    private static func viewportKey(_ provider: String) -> String { "maps.viewport.\(provider).v1" }

    static func readPreferences() -> MapPreferences {
        if let data = UserDefaults.standard.data(forKey: prefsKey),
           let prefs = try? JSONDecoder().decode(MapPreferences.self, from: data),
           prefs.version == 1 {
            return normalize(prefs)
        }
        // Migrate legacy split keys.
        let pack = UserDefaults.standard.string(forKey: "maps.activePack") ?? "light"
        let type = UserDefaults.standard.string(forKey: "maps.appleMapType") ?? "standard"
        let scheme = UserDefaults.standard.string(forKey: "maps.appleColorScheme") ?? "adaptive"
        let migrated: MapPreferences
        if pack == "light" {
            migrated = MapPreferences(
                version: 1, provider: "apple", customPackId: "dark",
                appleMapType: type, appleColorScheme: scheme
            )
        } else {
            migrated = MapPreferences(
                version: 1, provider: "custom", customPackId: pack,
                appleMapType: type, appleColorScheme: scheme
            )
        }
        writePreferences(migrated)
        return migrated
    }

    static func writePreferences(_ prefs: MapPreferences) {
        let normalized = normalize(prefs)
        if let data = try? JSONEncoder().encode(normalized) {
            UserDefaults.standard.set(data, forKey: prefsKey)
        }
        // Keep legacy keys in sync for older code paths / one release.
        UserDefaults.standard.set(
            normalized.provider == "apple" ? "light" : normalized.customPackId,
            forKey: "maps.activePack"
        )
        UserDefaults.standard.set(normalized.appleMapType, forKey: "maps.appleMapType")
        UserDefaults.standard.set(normalized.appleColorScheme, forKey: "maps.appleColorScheme")
    }

    static func readViewport(provider: String) -> SavedViewport? {
        guard let data = UserDefaults.standard.data(forKey: viewportKey(provider)),
              let v = try? JSONDecoder().decode(SavedViewport.self, from: data) else { return nil }
        guard v.latitudeDelta > 0, v.longitudeDelta > 0 else { return nil }
        return v
    }

    static func writeViewport(provider: String, _ viewport: SavedViewport) {
        if let data = try? JSONEncoder().encode(viewport) {
            UserDefaults.standard.set(data, forKey: viewportKey(provider))
        }
    }

    private static func normalize(_ p: MapPreferences) -> MapPreferences {
        var out = p
        out.version = 1
        if out.provider != "apple" && out.provider != "custom" { out.provider = "apple" }
        if out.customPackId.isEmpty { out.customPackId = "dark" }
        let types: Set = ["standard", "satellite", "hybrid", "muted"]
        if !types.contains(out.appleMapType) { out.appleMapType = "standard" }
        let schemes: Set = ["adaptive", "light", "dark"]
        if !schemes.contains(out.appleColorScheme) { out.appleColorScheme = "adaptive" }
        return out
    }
}
