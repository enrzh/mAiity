import CoreLocation
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

/// Which side panel occupies the contextual sheet slot (mirrors the web
/// Shell's `Panel` type). Selecting a place, starting a route, or loading
/// category results closes it — one thing at a time, like Maps.
enum SheetPanel {
    case none, saved, packs
}

@MainActor
final class AppModel: ObservableObject {
    @Published var user: User?
    @Published var packs: [Pack] = []
    @Published var customPacks: [Pack] = []
    @Published var route: RouteUI? {
        didSet { if route != nil { panel = .none } }
    }
    @Published var pickingStart = false
    @Published var pois: [GeoResult] = [] {
        didSet { if !pois.isEmpty { panel = .none } }
    }
    @Published var activeCategory: String?
    /// Contextual side panel (saved places / map styles) in the sheet.
    @Published var panel: SheetPanel = .none
    /// UI language ("maps.lang" in UserDefaults, same key @AppStorage uses).
    /// Published so every view re-renders live on switch.
    @Published var lang: String = L.current {
        didSet { UserDefaults.standard.set(lang, forKey: "maps.lang") }
    }

    func setLang(_ code: String) {
        guard L.supported.contains(code) else { return }
        lang = code
    }
    @Published var recents: [GeoResult] = []
    /// Live turn-by-turn session (nil when not navigating).
    @Published var nav: NavState?
    /// Current center of the native Apple map, used to bias nearby searches.
    @Published var mapCenter = CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45)

    struct NavState: Equatable {
        var stepIndex = 0
        var toManeuverM: Double?
        var remainingM: Double
        var remainingS: Double
        var offRoute = false
    }
    /// Set by the floating map button; the sheet presents the pack picker.
    @Published var showPackPicker = false
    /// One-shot startup position so the map opens where the user is.
    @Published var startupLocation: CameraEvent?
    @Published var activePackId: String {
        didSet { UserDefaults.standard.set(activePackId, forKey: "maps.activePack") }
    }
    @Published var bookmarks: [Bookmark] = []
    @Published var selected: Place? {
        didSet { if selected != nil { panel = .none } }
    }
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
        await locateOnStartup()
    }

    /// Open the map where the user actually is. Runs on every launch (not
    /// just the first) so the app always starts local; silently no-ops when
    /// permission is declined.
    func locateOnStartup() async {
        guard let loc = await LocationService.shared.currentLocation() else { return }
        startupLocation = CameraEvent(place: Place(
            name: L.t("my-location"), label: "", lat: loc.latitude, lon: loc.longitude))
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
            authError = L.t("err-unknown")
            return false
        }
    }

    static func errorText(_ code: String) -> String {
        let known = ["invalid_email", "password_too_short", "email_taken",
                     "invalid_credentials", "too_many_requests"]
        guard known.contains(code) else { return L.t("err-unknown") }
        return L.t("err-\(code.replacingOccurrences(of: "_", with: "-"))")
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
            place = Place(name: String(format: "%.5f, %.5f", lat, lon), label: L.t("unknown-place"), lat: lat, lon: lon)
        }
        if pickingStart { setRouteStart(place); return }
        selected = place
    }

    // MARK: - POI browsing

    func showCategory(_ cat: NearbyCategory, bounds: (west: Double, south: Double, east: Double, north: Double)? = nil) {
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
            let results = (try? await APIClient.shared.nearby(cat: cat.id, lat: center.lat, lon: center.lon, bounds: bounds)) ?? []
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

    // MARK: - Navigation

    private var navTask: Task<Void, Never>?
    private var lastSnapIndex = 0
    private var rerouteGuard = Date.distantPast

    var navigating: Bool { nav != nil }

    func startNavigation() {
        guard let r = route?.result, r.geometry.count > 1 else { return }
        lastSnapIndex = 0
        nav = NavState(remainingM: Double(r.distanceM), remainingS: Double(r.durationS))
        navTask?.cancel()
        navTask = Task { [weak self] in
            // Drive off the location stream; each fix advances the session.
            while !Task.isCancelled {
                guard let self, self.nav != nil else { return }
                if let loc = await LocationService.shared.currentLocation() {
                    self.advance(with: loc)
                }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    func stopNavigation() {
        navTask?.cancel()
        navTask = nil
        nav = nil
    }

    private func advance(with loc: CLLocationCoordinate2D) {
        guard let r = route?.result, r.geometry.count > 1 else { return }
        let pos = (lon: loc.longitude, lat: loc.latitude)
        let snap = Nav.snap(position: pos, geometry: r.geometry, from: lastSnapIndex)
        lastSnapIndex = snap.index

        let si = Nav.currentStep(r.steps, index: snap.index)
        var toManeuver: Double?
        if si + 1 < r.steps.count {
            toManeuver = Nav.metresToManeuver(
                geometry: r.geometry, index: snap.index,
                position: pos, nextBeginIdx: r.steps[si + 1].beginIdx)
        }
        let frac = snap.remainingM / max(1, Double(r.distanceM))
        let off = snap.offRouteM > Nav.offRouteM
        nav = NavState(stepIndex: si, toManeuverM: toManeuver,
                       remainingM: snap.remainingM,
                       remainingS: Double(r.durationS) * frac,
                       offRoute: off)

        // Left the line — recompute from where we actually are (rate-limited).
        if off, Date().timeIntervalSince(rerouteGuard) > 12 {
            rerouteGuard = Date()
            setRouteStart(Place(name: L.t("current-position"), label: "", lat: loc.latitude, lon: loc.longitude))
        }

        // Follow camera: heading from the route direction at our position.
        let nextIdx = min(snap.index + 1, r.geometry.count - 1)
        let head = Nav.bearing(pos, (lon: r.geometry[nextIdx][0], lat: r.geometry[nextIdx][1]))
        navCamera = NavCamera(center: loc, heading: head)
    }

    /// Consumed by MapScreen to drive the follow camera.
    struct NavCamera: Equatable {
        let id = UUID()
        let center: CLLocationCoordinate2D
        let heading: Double

        static func == (lhs: NavCamera, rhs: NavCamera) -> Bool {
            lhs.center.latitude == rhs.center.latitude &&
            lhs.center.longitude == rhs.center.longitude &&
            lhs.heading == rhs.heading
        }
    }
    @Published var navCamera: NavCamera?

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
        stopNavigation()
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
                                         errorText: L.t("route-err-no-location"))
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
                    self.route = RouteUI(from: fromPlace, to: place, mode: mode, status: .error, errorText: L.t("route-err-not-found"))
                }
            } catch {
                if !Task.isCancelled {
                    self.route = RouteUI(from: fromPlace, to: place, mode: mode, status: .error,
                                         errorText: L.t("route-err-unavailable"))
                }
            }
        }
    }
}
