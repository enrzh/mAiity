import Foundation

// Codable mirrors of the maps API. One source of truth: server/src/*.ts.

struct User: Codable, Equatable {
    let id: String
    let email: String?
    let displayName: String?
}

struct SessionResponse: Codable {
    let accessToken: String
    let expiresIn: Int
    let refreshToken: String?   // absent for web clients; present for us
    let user: User
}

struct Bookmark: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    let lat: Double
    let lon: Double
    var icon: String
    var note: String
    let createdAt: Int
    let updatedAt: Int
}

struct Pack: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let version: String
    let description: String
    let styleUrl: String
    let preview: Preview?
    var custom: Bool? = nil

    struct Preview: Codable, Equatable {
        let colors: [String]?
    }

    /// Absolute style URL — server sends site-relative paths for built-ins
    /// and stored packs, absolute https URLs for url-installed packs.
    var absoluteStyleURL: URL {
        if styleUrl.hasPrefix("http") { return URL(string: styleUrl)! }
        return URL(string: "https://privatenas.nl\(styleUrl)")!
    }

    var isCustom: Bool { custom == true }
}

struct PacksResponse: Codable { let packs: [Pack] }

struct GeoResult: Codable, Identifiable, Equatable {
    let name: String
    let label: String
    let lat: Double
    let lon: Double
    let kind: String
    var id: String { "\(lat),\(lon),\(name)" }
}

struct GeoResponse: Codable { let results: [GeoResult] }

struct UserSettings: Codable {
    let activePack: String?
}

/// A selected point on the map (search result, tap, or bookmark).
struct Place: Equatable {
    var name: String
    var label: String
    var lat: Double
    var lon: Double
}

// ---- Routing ---------------------------------------------------------------

enum RouteMode: String, Codable, CaseIterable {
    case car, bike, foot

    var label: String {
        switch self {
        case .car: return "Auto"
        case .bike: return "Rad"
        case .foot: return "Zu Fuß"
        }
    }

    var symbol: String {
        switch self {
        case .car: return "car.fill"
        case .bike: return "bicycle"
        case .foot: return "figure.walk"
        }
    }
}

struct NearbyCategory: Identifiable, Equatable {
    let id: String
    let label: String
    let emoji: String

    static let all: [NearbyCategory] = [
        .init(id: "restaurant", label: "Restaurants", emoji: "🍽️"),
        .init(id: "cafe", label: "Cafés", emoji: "☕"),
        .init(id: "supermarket", label: "Supermärkte", emoji: "🛒"),
        .init(id: "fuel", label: "Tankstellen", emoji: "⛽"),
        .init(id: "pharmacy", label: "Apotheken", emoji: "💊"),
        .init(id: "hotel", label: "Hotels", emoji: "🛏️"),
        .init(id: "parking", label: "Parken", emoji: "🅿️"),
        .init(id: "atm", label: "Geldautomaten", emoji: "🏧"),
    ]
}

struct RouteStep: Codable, Equatable {
    let instruction: String
    let distanceM: Int
    let durationS: Int
}

struct RouteResult: Codable, Equatable {
    let mode: String
    let distanceM: Int
    let durationS: Int
    let geometry: [[Double]]   // [lon, lat] pairs
    let steps: [RouteStep]
}
