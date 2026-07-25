import Foundation
import SwiftUI

/// Single app-wide observable state. All mutations happen on the main actor;
/// network work is delegated to APIClient.
struct RouteUI: Equatable {
    /** Explicit start, or nil = the user's current location. */
    var from: Place?
    var to: Place
    var mode: RouteMode
    var status: Status
    var result: RouteResult?
    var errorText: String?

    enum Status: Equatable { case loading, ready, error }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var user: User?
    @Published var packs: [Pack] = []
    @Published var customPacks: [Pack] = []
    @Published var route: RouteUI?
    @Published var pickingStart = false
    @Published var pois: [GeoResult] = []
    @Published var activeCategory: String?
    @Published var recents: [GeoResult] = []
    /// Set by the floating map button; the sheet presents the pack picker.
    @Published var showPackPicker = false
    /// One-shot startup position so the map opens where the user is.
    @Published var startupLocation: CameraEvent?
    @Published var activePackId: String {
        didSet { UserDefaults.standard.set(activePackId, forKey: "maps.activePack") }
    }
    @Published var bookmarks: [Bookmark] = []
    @Published var selected: Place?
    @Published var searchResults: [GeoResult] = []
    @Published var searchQuery = "" {
        didSet { if !suppressSearch { scheduleSearch() } }
    }
    @Published var searching = false
    @Published var authError: String?
    @Published var bootFailed = false

    /// One-shot camera event (identity-tagged so re-selecting the same place
    /// still moves the camera).
    struct CameraEvent: Equatable {
        let id = UUID()
        let place: Place
    }
    @Published var cameraTarget: CameraEvent?

    private var searchTask: Task<Void, Never>?
    private var poiTask: Task<Void, Never>?
    private var suppressSearch = false

    /// Set the search field without scheduling a search (result picked).
    func setQueryQuietly(_ q: String) {
        suppressSearch = true
        searchQuery = q
        suppressSearch = false
        searchTask?.cancel()
        searching = false
    }

    init() {
        activePackId = UserDefaults.standard.string(forKey: "maps.activePack") ?? "light"
        if let data = UserDefaults.standard.data(forKey: "maps.recents"),
           let stored = try? JSONDecoder().decode([GeoResult].self, from: data) {
            recents = stored
        }
    }

    private func recordRecent(_ r: GeoResult) {
        recents.removeAll { $0.lat == r.lat && $0.lon == r.lon }
        recents.insert(r, at: 0)
        recents = Array(recents.prefix(8))
        if let data = try? JSONEncoder().encode(recents) {
            UserDefaults.standard.set(data, forKey: "maps.recents")
        }
    }

    var allPacks: [Pack] { packs + customPacks }

    var activePack: Pack? {
        allPacks.first { $0.id == activePackId }
            ?? allPacks.first { $0.id == "light" }
            ?? allPacks.first
    }

    var styleURL: URL? { activePack?.absoluteStyleURL }

    // MARK: - Boot

    func boot() async {
        bootFailed = false
        if let packs = try? await APIClient.shared.packs(), !packs.isEmpty {
            self.packs = packs
        } else if self.packs.isEmpty {
            bootFailed = true // first launch offline — show retry instead of spinner
        }
        if let user = await APIClient.shared.resume() {
            self.user = user
            await loadUserData()
        }
        // Open the map where the user actually is (no-op if they decline).
        if let loc = await LocationService.shared.currentLocation() {
            startupLocation = CameraEvent(place: Place(
                name: "Mein Standort", label: "", lat: loc.latitude, lon: loc.longitude))
        }
    }

    private func loadUserData() async {
        if let bms = try? await APIClient.shared.bookmarks() { bookmarks = bms }
        if let ups = try? await APIClient.shared.userPacks() { customPacks = ups }
        if let s = await APIClient.shared.settings(), let pack = s.activePack {
            activePackId = pack
        }
    }

    // MARK: - Auth

    func login(email: String, password: String) async -> Bool {
        await authAction { try await APIClient.shared.login(email: email, password: password) }
    }

    func register(email: String, password: String) async -> Bool {
        await authAction { try await APIClient.shared.register(email: email, password: password) }
    }

    func signInWithApple(identityToken: String, fullName: String?) async -> Bool {
        await authAction { try await APIClient.shared.loginWithApple(identityToken: identityToken, fullName: fullName) }
    }

    private func authAction(_ op: () async throws -> User) async -> Bool {
        authError = nil
        do {
            user = try await op()
            await loadUserData()
            await APIClient.shared.saveSettings(activePack: activePackId)
            return true
        } catch let e as APIClient.APIError {
            authError = Self.errorText(e.code)
            return false
        } catch {
            authError = "Etwas ist schiefgelaufen — bitte erneut versuchen."
            return false
        }
    }

    static func errorText(_ code: String) -> String {
        switch code {
        case "invalid_email": return "Bitte eine gültige E-Mail-Adresse eingeben."
        case "password_too_short": return "Passwort muss mindestens 8 Zeichen haben."
        case "email_taken": return "Diese E-Mail ist bereits registriert."
        case "invalid_credentials": return "E-Mail oder Passwort ist falsch."
        case "too_many_requests": return "Zu viele Versuche — bitte kurz warten."
        default: return "Etwas ist schiefgelaufen — bitte erneut versuchen."
        }
    }

    func logout() async {
        await APIClient.shared.logout()
        user = nil
        bookmarks = []
        customPacks = []
        clearRoute() // cancels an in-flight route task — it must not resurrect
        clearPois()
        if activePackId.hasPrefix("u-") { activePackId = "light" }
    }

    // MARK: - Search

    private func scheduleSearch() {
        searchTask?.cancel()
        let q = searchQuery.trimmingCharacters(in: .whitespaces)
        guard q.count >= 3 else { searchResults = []; searching = false; return }
        searching = true
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled, let self else { return }
            let bias = self.cameraTarget.map { (lat: $0.place.lat, lon: $0.place.lon) }
            let results = (try? await APIClient.shared.geocode(q, bias: bias)) ?? []
            guard !Task.isCancelled else { return }
            self.searchResults = results
            self.searching = false
        }
    }

    func select(result: GeoResult) {
        let place = Place(name: result.name, label: result.label, lat: result.lat, lon: result.lon)
        if pickingStart { setRouteStart(place); return }
        recordRecent(result)
        selected = place
        cameraTarget = CameraEvent(place: place)
        searchResults = []
    }

    func select(bookmark: Bookmark) {
        let place = Place(name: bookmark.name, label: bookmark.note.isEmpty ? bookmark.name : bookmark.note, lat: bookmark.lat, lon: bookmark.lon)
        selected = place
        cameraTarget = CameraEvent(place: place)
    }

    func selectTap(lat: Double, lon: Double) async {
        let place: Place
        if let r = await APIClient.shared.reverse(lat: lat, lon: lon) {
            place = Place(name: r.name, label: r.label, lat: r.lat, lon: r.lon)
        } else {
            place = Place(name: String(format: "%.5f, %.5f", lat, lon), label: "Unbekannter Ort", lat: lat, lon: lon)
        }
        if pickingStart { setRouteStart(place); return }
        selected = place
    }

    // MARK: - POI browsing

    func showCategory(_ cat: NearbyCategory) {
        poiTask?.cancel()
        if activeCategory == cat.id { clearPois(); return }
        activeCategory = cat.id
        poiTask = Task { [weak self] in
            guard let self else { return }
            // Search around: the selected place, else the user, else the last
            // camera target, else the Germany overview center.
            var center = (lat: 51.16, lon: 10.45)
            if let s = self.selected { center = (s.lat, s.lon) }
            else if let loc = await LocationService.shared.currentLocation() { center = (loc.latitude, loc.longitude) }
            else if let t = self.cameraTarget { center = (t.place.lat, t.place.lon) }
            guard !Task.isCancelled else { return }
            let results = (try? await APIClient.shared.nearby(cat: cat.id, lat: center.lat, lon: center.lon)) ?? []
            guard !Task.isCancelled else { return }
            self.pois = results
        }
    }

    func clearPois() {
        poiTask?.cancel()
        pois = []
        activeCategory = nil
    }

    // MARK: - Bookmarks

    func bookmarkFor(_ place: Place) -> Bookmark? {
        bookmarks.first { abs($0.lat - place.lat) < 1e-5 && abs($0.lon - place.lon) < 1e-5 }
    }

    /// Returns false when the user must log in first.
    /// Local state only mutates when the server call SUCCEEDS (404 on delete
    /// counts — the bookmark is gone either way).
    @discardableResult
    func toggleBookmark(_ place: Place) async -> Bool {
        guard user != nil else { return false }
        if let existing = bookmarkFor(place) {
            await deleteBookmarkSynced(existing.id)
        } else if let created = try? await APIClient.shared.addBookmark(name: place.name, lat: place.lat, lon: place.lon) {
            bookmarks.insert(created, at: 0)
        }
        return true
    }

    func removeBookmark(_ id: String) async {
        await deleteBookmarkSynced(id)
    }

    private func deleteBookmarkSynced(_ id: String) async {
        do {
            try await APIClient.shared.deleteBookmark(id: id)
            bookmarks.removeAll { $0.id == id }
        } catch let e as APIClient.APIError where e.status == 404 {
            bookmarks.removeAll { $0.id == id } // already gone server-side
        } catch {
            // Server still has it — keep it visible rather than lying.
        }
    }

    // MARK: - Packs

    func setPack(_ id: String) {
        activePackId = id
        if user != nil {
            Task { await APIClient.shared.saveSettings(activePack: id) }
        }
    }

    func installPack(name: String, styleUrl: String?, styleJson: String?) async throws {
        let created = try await APIClient.shared.installPack(name: name, styleUrl: styleUrl, styleJson: styleJson)
        customPacks.insert(created, at: 0)
        setPack(created.id)
    }

    func removePack(_ id: String) async {
        try? await APIClient.shared.deletePack(id: id)
        customPacks.removeAll { $0.id == id }
        if activePackId == id { setPack("light") }
    }

    // MARK: - Routing

    private var routeTask: Task<Void, Never>?

    func startRoute(to place: Place) {
        requestRoute(from: nil, to: place, mode: route?.mode ?? .car)
    }

    func setRouteMode(_ mode: RouteMode) {
        guard let r = route else { return }
        requestRoute(from: r.from, to: r.to, mode: mode)
    }

    func setRouteStart(_ place: Place?) {
        guard let r = route else { pickingStart = false; return }
        requestRoute(from: place, to: r.to, mode: r.mode)
    }

    func swapRoute() {
        guard let r = route, let from = r.from else { return }
        requestRoute(from: r.to, to: from, mode: r.mode)
    }

    func beginPickStart() {
        pickingStart = true
    }

    func clearRoute() {
        routeTask?.cancel()
        route = nil
        pickingStart = false
    }

    private func requestRoute(from fromPlace: Place?, to place: Place, mode: RouteMode) {
        routeTask?.cancel()
        selected = nil
        pickingStart = false
        route = RouteUI(from: fromPlace, to: place, mode: mode, status: .loading)
        routeTask = Task { [weak self] in
            guard let self else { return }
            let from: (lat: Double, lon: Double)
            if let f = fromPlace {
                from = (f.lat, f.lon)
            } else if let loc = await LocationService.shared.currentLocation() {
                from = (loc.latitude, loc.longitude)
            } else {
                if !Task.isCancelled {
                    self.route = RouteUI(from: fromPlace, to: place, mode: mode, status: .error,
                                         errorText: "Standort nicht verfügbar — Startpunkt wählen oder Standortzugriff erlauben.")
                }
                return
            }
            do {
                let result = try await APIClient.shared.route(
                    from: from, to: (place.lat, place.lon), mode: mode)
                if !Task.isCancelled {
                    self.route = RouteUI(from: fromPlace, to: place, mode: mode, status: .ready, result: result)
                }
            } catch let e as APIClient.APIError where e.code == "no_route_found" {
                if !Task.isCancelled {
                    self.route = RouteUI(from: fromPlace, to: place, mode: mode, status: .error, errorText: "Keine Route gefunden.")
                }
            } catch {
                if !Task.isCancelled {
                    self.route = RouteUI(from: fromPlace, to: place, mode: mode, status: .error,
                                         errorText: "Routenberechnung derzeit nicht verfügbar.")
                }
            }
        }
    }
}
