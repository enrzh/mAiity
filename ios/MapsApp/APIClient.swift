import Foundation

/// Async client for the maps API. Access token lives in memory; the refresh
/// token lives in the keychain. 401s trigger one transparent refresh + retry,
/// with refreshes single-flighted through an actor.
actor APIClient {
    static let shared = APIClient()

    private let base = URL(string: "https://privatenas.nl/maps/api")!
    private var accessToken: String?
    private var refreshTask: Task<Bool, Never>?

    private static let refreshKey = "refreshToken"

    struct APIError: Error {
        let code: String
        let status: Int
    }

    // MARK: - Plumbing

    private func request(
        _ method: String,
        _ path: String,
        body: (any Encodable)? = nil,
        authed: Bool = false,
        retried: Bool = false
    ) async throws -> Data {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authed, let token = accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 && authed && !retried {
            if await refreshSession() {
                return try await request(method, path, body: body, authed: authed, retried: true)
            }
        }
        guard (200..<300).contains(status) else {
            let code = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "http_\(status)"
            throw APIError(code: code, status: status)
        }
        return data
    }

    nonisolated private func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
        try JSONDecoder().decode(type, from: data)
    }

    private func storeSession(_ s: SessionResponse) {
        accessToken = s.accessToken
        if let rt = s.refreshToken { Keychain.set(rt, forKey: Self.refreshKey) }
    }

    /// Single-flight refresh: concurrent 401s await the same attempt.
    private func refreshSession() async -> Bool {
        if let running = refreshTask { return await running.value }
        let task = Task<Bool, Never> { [weak self] in
            guard let self else { return false }
            guard let rt = Keychain.get(Self.refreshKey) else { return false }
            do {
                let data = try await self.request("POST", "auth/refresh", body: ["refreshToken": rt])
                let session = try self.decode(SessionResponse.self, data)
                await self.storeSession(session)
                return true
            } catch let e as APIError where e.status == 401 || e.status == 403 {
                // The SERVER rejected the token — it's dead, drop it.
                Keychain.delete(Self.refreshKey)
                return false
            } catch {
                // Transient (offline, timeout, 5xx) — keep the token; the
                // session resumes on the next attempt with connectivity.
                return false
            }
        }
        refreshTask = task
        let ok = await task.value
        refreshTask = nil
        return ok
    }

    // MARK: - Session

    func resume() async -> User? {
        guard await refreshSession() else { return nil }
        guard let data = try? await request("GET", "auth/me", authed: true) else { return nil }
        return try? decode(User.self, data)
    }

    func register(email: String, password: String) async throws -> User {
        let s = try decode(SessionResponse.self, await request("POST", "auth/register", body: ["email": email, "password": password]))
        storeSession(s)
        return s.user
    }

    func login(email: String, password: String) async throws -> User {
        let s = try decode(SessionResponse.self, await request("POST", "auth/login", body: ["email": email, "password": password]))
        storeSession(s)
        return s.user
    }

    func loginWithApple(identityToken: String, fullName: String?) async throws -> User {
        var body: [String: String] = ["identityToken": identityToken]
        if let fullName, !fullName.isEmpty { body["fullName"] = fullName }
        let s = try decode(SessionResponse.self, await request("POST", "auth/apple", body: body))
        storeSession(s)
        return s.user
    }

    func logout() async {
        let rt = Keychain.get(Self.refreshKey)
        _ = try? await request("POST", "auth/logout", body: ["refreshToken": rt ?? ""])
        Keychain.delete(Self.refreshKey)
        accessToken = nil
    }

    // MARK: - Data

    func packs() async throws -> [Pack] {
        try decode(PacksResponse.self, await request("GET", "packs")).packs
    }

    func geocode(_ q: String, bias: (lat: Double, lon: Double)?) async throws -> [GeoResult] {
        var comps = URLComponents(url: base.appendingPathComponent("geocode"), resolvingAgainstBaseURL: false)!
        var items = [URLQueryItem(name: "q", value: q), URLQueryItem(name: "limit", value: "7")]
        if let bias {
            items.append(URLQueryItem(name: "lat", value: String(bias.lat)))
            items.append(URLQueryItem(name: "lon", value: String(bias.lon)))
        }
        comps.queryItems = items
        // URLComponents leaves '+' literal, which Node backends decode as a
        // space — re-encode it so "C++ Museum" style queries survive.
        comps.percentEncodedQuery = comps.percentEncodedQuery?
            .replacingOccurrences(of: "+", with: "%2B")
        let (data, resp) = try await URLSession.shared.data(from: comps.url!)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return [] }
        return try decode(GeoResponse.self, data).results
    }

    func nearby(cat: String, lat: Double, lon: Double) async throws -> [GeoResult] {
        var comps = URLComponents(url: base.appendingPathComponent("nearby"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "cat", value: cat),
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lon", value: String(lon)),
        ]
        let (data, resp) = try await URLSession.shared.data(from: comps.url!)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return [] }
        return try decode(GeoResponse.self, data).results
    }

    func reverse(lat: Double, lon: Double) async -> GeoResult? {
        var comps = URLComponents(url: base.appendingPathComponent("reverse"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lon", value: String(lon)),
        ]
        guard let (data, resp) = try? await URLSession.shared.data(from: comps.url!),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let decoded = try? decode(GeoResponse.self, data) else { return nil }
        return decoded.results.first
    }

    func bookmarks() async throws -> [Bookmark] {
        try decode([Bookmark].self, await request("GET", "bookmarks", authed: true))
    }

    func addBookmark(name: String, lat: Double, lon: Double) async throws -> Bookmark {
        struct Body: Encodable { let name: String; let lat: Double; let lon: Double }
        return try decode(Bookmark.self, await request("POST", "bookmarks", body: Body(name: name, lat: lat, lon: lon), authed: true))
    }

    func deleteBookmark(id: String) async throws {
        _ = try await request("DELETE", "bookmarks/\(id)", authed: true)
    }

    func route(
        from: (lat: Double, lon: Double),
        to: (lat: Double, lon: Double),
        mode: RouteMode
    ) async throws -> RouteResult {
        struct Point: Encodable { let lat: Double; let lon: Double }
        struct Body: Encodable { let from: Point; let to: Point; let mode: String }
        let body = Body(from: .init(lat: from.lat, lon: from.lon),
                        to: .init(lat: to.lat, lon: to.lon),
                        mode: mode.rawValue)
        return try decode(RouteResult.self, await request("POST", "route", body: body))
    }

    func userPacks() async throws -> [Pack] {
        try decode(PacksResponse.self, await request("GET", "user/packs", authed: true)).packs
    }

    func installPack(name: String, styleUrl: String?, styleJson: String?) async throws -> Pack {
        struct Body: Encodable { let name: String; let styleUrl: String?; let styleJson: String? }
        return try decode(Pack.self, await request("POST", "user/packs", body: Body(name: name, styleUrl: styleUrl, styleJson: styleJson), authed: true))
    }

    func deletePack(id: String) async throws {
        _ = try await request("DELETE", "user/packs/\(id)", authed: true)
    }

    func settings() async -> UserSettings? {
        try? decode(UserSettings.self, await request("GET", "user/settings", authed: true))
    }

    func saveSettings(activePack: String) async {
        _ = try? await request("PUT", "user/settings", body: ["activePack": activePack], authed: true)
    }
}
