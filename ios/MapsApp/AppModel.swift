import CoreLocation
import Foundation
import MapKit
import SwiftUI
import UIKit

struct DrivingRun: Codable, Equatable, Identifiable {
    let id: UUID
    let createdAt: Date
    let duration: TimeInterval
    let distanceM: Double
    let averageSpeedKmh: Double
}

enum DrivingRunStore {
    private static let key = "maps.drivingRuns.v1"
    static func load() -> [DrivingRun] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let runs = try? JSONDecoder().decode([DrivingRun].self, from: data) else { return [] }
        return Array(runs.prefix(20))
    }
    static func append(_ run: DrivingRun) -> [DrivingRun] {
        let runs = Array(([run] + load()).prefix(20))
        if let data = try? JSONEncoder().encode(runs) { UserDefaults.standard.set(data, forKey: key) }
        return runs
    }
}

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
    @Published var driving: DrivingState = .idle
    @Published var drivingRuns: [DrivingRun] = DrivingRunStore.load()
    /// Current center of the native Apple map, used to bias nearby searches.
    @Published var mapCenter = CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45)

    struct NavState: Equatable {
        var stepIndex = 0
        var toManeuverM: Double?
        var remainingM: Double
        var remainingS: Double
        var offRoute = false
    }

    enum DrivingState: Equatable {
        case idle
        case ready(elapsed: TimeInterval, progress: Double, duration: TimeInterval, distanceM: Double)
        case running(elapsed: TimeInterval, progress: Double, duration: TimeInterval, distanceM: Double)
        case paused(elapsed: TimeInterval, progress: Double, duration: TimeInterval, distanceM: Double)
        case finished(elapsed: TimeInterval, progress: Double, duration: TimeInterval, distanceM: Double)

        var progress: Double {
            switch self { case .idle: return 0; case let .ready(_, p, _, _), let .running(_, p, _, _), let .paused(_, p, _, _), let .finished(_, p, _, _): return p }
        }
        var elapsed: TimeInterval {
            switch self { case .idle: return 0; case let .ready(e, _, _, _), let .running(e, _, _, _), let .paused(e, _, _, _), let .finished(e, _, _, _): return e }
        }
        var distanceM: Double {
            switch self { case .idle: return 0; case let .ready(_, _, _, d), let .running(_, _, _, d), let .paused(_, _, _, d), let .finished(_, _, _, d): return d }
        }
        var isImmersive: Bool {
            switch self { case .running, .paused, .finished: return true; default: return false }
        }
    }
    /// Live race input + physics (mirrors web drivingGame).
    @Published var raceInput = DrivingInput()
    @Published var raceSpeedMps: Double = 0
    @Published var raceLateral: Double = 0
    /// Shared 3-2-1 countdown (nil = idle). Driven by RaceHUDView.
    @Published var raceCountdown: Int? = nil
    /// Set by the floating map button; the sheet presents the pack picker.
    @Published var showPackPicker = false
    /// One-shot startup position so the map opens where the user is.
    @Published var startupLocation: CameraEvent?
    @Published var activePackId: String {
        didSet { persistMapPreferences() }
    }
    @Published var appleMapType: String {
        didSet { persistMapPreferences() }
    }
    @Published var appleColorScheme: String {
        didSet { persistMapPreferences() }
    }
    /// Live map region for “search this area” + viewport persistence.
    @Published var mapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 51.16, longitude: 10.45),
        span: MKCoordinateSpan(latitudeDelta: 8, longitudeDelta: 11)
    )
    @Published var mapMovedForCategory = false
    private var categoryAnchor: CLLocationCoordinate2D?
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
        let prefs = MapPersistence.readPreferences()
        activePackId = prefs.provider == "apple" ? "light" : prefs.customPackId
        appleMapType = prefs.appleMapType
        appleColorScheme = prefs.appleColorScheme
        if let saved = MapPersistence.readViewport(provider: prefs.provider) {
            mapRegion = saved.region
        }
        if let data = UserDefaults.standard.data(forKey: "maps.recents"),
           let stored = try? JSONDecoder().decode([GeoResult].self, from: data) {
            recents = stored
        }
    }

    private func persistMapPreferences() {
        MapPersistence.writePreferences(MapPreferences(
            version: 1,
            provider: activePackId == "light" ? "apple" : "custom",
            customPackId: activePackId == "light" ? "dark" : activePackId,
            appleMapType: appleMapType,
            appleColorScheme: appleColorScheme
        ))
    }

    /// Called by map screens when the camera settles.
    func noteMapRegion(_ region: MKCoordinateRegion) {
        mapRegion = region
        let provider = activePackId == "light" ? "apple" : "custom"
        MapPersistence.writeViewport(provider: provider, SavedViewport(region: region))
        if let anchor = categoryAnchor, activeCategory != nil {
            let d = Nav.distance(
                (lon: anchor.longitude, lat: anchor.latitude),
                (lon: region.center.longitude, lat: region.center.latitude)
            )
            if d > 350 { mapMovedForCategory = true }
        }
    }

    func searchThisArea() {
        guard let id = activeCategory,
              let cat = NearbyCategory.all.first(where: { $0.id == id }) else { return }
        let r = mapRegion
        let halfLat = r.span.latitudeDelta / 2
        let halfLon = r.span.longitudeDelta / 2
        let bounds = (
            west: r.center.longitude - halfLon,
            south: r.center.latitude - halfLat,
            east: r.center.longitude + halfLon,
            north: r.center.latitude + halfLat
        )
        mapMovedForCategory = false
        categoryAnchor = r.center
        // Force re-query even if same category (don't toggle off).
        poiTask?.cancel()
        activeCategory = cat.id
        poiTask = Task { [weak self] in
            guard let self else { return }
            let center = (lat: r.center.latitude, lon: r.center.longitude)
            let results = (try? await APIClient.shared.nearby(
                cat: cat.id, lat: center.lat, lon: center.lon, bounds: bounds
            )) ?? []
            guard !Task.isCancelled else { return }
            self.pois = results
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
        mapMovedForCategory = false
        categoryAnchor = mapRegion.center
        poiTask = Task { [weak self] in
            guard let self else { return }
            // Search around: the selected place, else the user, else the last
            // camera target, else the Germany overview center.
            var center = (lat: 51.16, lon: 10.45)
            if let s = self.selected { center = (s.lat, s.lon) }
            else if let loc = await LocationService.shared.currentLocation() { center = (loc.latitude, loc.longitude) }
            else if let t = self.cameraTarget { center = (t.place.lat, t.place.lon) }
            else { center = (self.mapRegion.center.latitude, self.mapRegion.center.longitude) }
            guard !Task.isCancelled else { return }
            let results = (try? await APIClient.shared.nearby(cat: cat.id, lat: center.lat, lon: center.lon, bounds: bounds)) ?? []
            guard !Task.isCancelled else { return }
            self.pois = results
            self.categoryAnchor = CLLocationCoordinate2D(latitude: center.lat, longitude: center.lon)
        }
    }

    func clearPois() {
        poiTask?.cancel()
        pois = []
        activeCategory = nil
        mapMovedForCategory = false
        categoryAnchor = nil
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

    func setAppleProvider() {
        setPack("light")
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
        stopDriving()
    }

    // MARK: - Driving mode

    private var drivingTask: Task<Void, Never>?

    func prepareDriving() {
        guard let r = route?.result, r.mode == "car", r.geometry.count > 1 else {
            stopDriving()
            return
        }
        let duration = max(30, Double(r.durationS) * 0.72)
        raceInput = DrivingInput()
        raceSpeedMps = 0
        raceLateral = 0
        driving = .ready(elapsed: 0, progress: 0, duration: duration, distanceM: Double(r.distanceM))
        publishDrivingCamera(progress: 0, lateral: 0)
    }

    /// Begin 3-2-1 countdown; HUD completes it and calls `startDriving()`.
    func requestStartRace() {
        guard case .ready = driving else { return }
        raceCountdown = 3
    }

    func cancelRaceCountdown() { raceCountdown = nil }

    func startDriving() {
        guard case let .ready(elapsed, progress, duration, distance) = driving else { return }
        raceCountdown = nil
        startDrivingLoop(elapsed: elapsed, progress: progress, duration: duration, distance: distance)
    }

    func pauseDriving() {
        guard case let .running(elapsed, progress, duration, distance) = driving else { return }
        drivingTask?.cancel(); drivingTask = nil
        raceInput = DrivingInput()
        // Keep physics progress (do not recompute from wall clock).
        driving = .paused(elapsed: elapsed, progress: progress, duration: duration, distanceM: distance)
    }

    func resumeDriving() {
        guard case let .paused(elapsed, progress, duration, distance) = driving else { return }
        startDrivingLoop(elapsed: elapsed, progress: progress, duration: duration, distance: distance)
    }

    func finishDriving() {
        switch driving {
        case let .running(elapsed, _, duration, distance), let .paused(elapsed, _, duration, distance):
            completeDriving(elapsed: elapsed, duration: duration, distance: distance)
        default:
            return
        }
    }

    /// Re-arm the same car route for another race after finish.
    func resetDriving() {
        guard case let .finished(_, _, duration, distance) = driving else {
            prepareDriving()
            return
        }
        drivingTask?.cancel(); drivingTask = nil
        raceInput = DrivingInput()
        raceSpeedMps = 0
        raceLateral = 0
        driving = .ready(elapsed: 0, progress: 0, duration: duration, distanceM: distance)
        publishDrivingCamera(progress: 0, lateral: 0)
    }

    func stopDriving() {
        drivingTask?.cancel(); drivingTask = nil
        driving = .idle
        raceInput = DrivingInput()
        raceSpeedMps = 0
        raceLateral = 0
        navCamera = nil
    }

    func setRaceThrottle(_ on: Bool) { raceInput.throttle = on }
    func setRaceBrake(_ on: Bool) { raceInput.brake = on }
    func setRaceSteer(_ value: Double) { raceInput.steer = max(-1, min(1, value)) }

    private func startDrivingLoop(elapsed: TimeInterval, progress: Double, duration: TimeInterval, distance: Double) {
        drivingTask?.cancel()
        raceSpeedMps = 0
        var state = DrivingPhysicsState(progress: progress, speedMps: raceSpeedMps, lateral: raceLateral)
        var elapsedAcc = elapsed
        var lastTick = Date()
        driving = .running(elapsed: elapsed, progress: progress, duration: duration, distanceM: distance)
        publishDrivingCamera(progress: progress, lateral: raceLateral)
        drivingTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let now = Date()
                let dt = min(0.1, max(0, now.timeIntervalSince(lastTick)))
                lastTick = now
                state = DrivingPhysics.step(state, input: self.raceInput, dt: dt, distanceM: distance)
                elapsedAcc = min(duration, elapsedAcc + dt)
                self.raceSpeedMps = state.speedMps
                self.raceLateral = state.lateral
                self.driving = .running(
                    elapsed: elapsedAcc,
                    progress: state.progress,
                    duration: duration,
                    distanceM: distance
                )
                self.publishDrivingCamera(progress: state.progress, lateral: state.lateral)
                if state.progress >= 1 {
                    self.completeDriving(elapsed: elapsedAcc, duration: duration, distance: distance)
                    return
                }
                try? await Task.sleep(nanoseconds: 33_000_000) // ~30 fps
            }
        }
    }

    /// Street-level chase cam for race mode (same idea as web MapLibre/Apple).
    private func publishDrivingCamera(progress: Double, lateral: Double) {
        guard let geometry = route?.result?.geometry, geometry.count > 1 else { return }
        let car = DrivingPhysics.carPosition(progress: progress, lateral: lateral, geometry: geometry)
        // Look slightly ahead so the street opens in front of the car.
        let lookM = 28.0
        let rad = car.heading * .pi / 180
        let dLat = (lookM / 111_320) * cos(rad)
        let cosLat = max(0.2, cos(car.lat * .pi / 180))
        let dLon = (lookM / (111_320 * cosLat)) * sin(rad)
        navCamera = NavCamera(
            center: CLLocationCoordinate2D(latitude: car.lat + dLat, longitude: car.lon + dLon),
            heading: car.heading
        )
    }

    private func completeDriving(elapsed: TimeInterval, duration: TimeInterval, distance: Double) {
        drivingTask?.cancel(); drivingTask = nil
        raceInput = DrivingInput()
        raceSpeedMps = 0
        driving = .finished(elapsed: min(elapsed, duration), progress: 1, duration: duration, distanceM: distance)
        let hours = max(0.0001, elapsed / 3600)
        drivingRuns = DrivingRunStore.append(DrivingRun(
            id: UUID(), createdAt: Date(), duration: elapsed, distanceM: distance,
            averageSpeedKmh: distance / 1000 / hours
        ))
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func requestRoute(from fromPlace: Place?, to place: Place, mode: RouteMode) {
        routeTask?.cancel()
        selected = nil
        pickingStart = false
        stopDriving()
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
                    if mode == .car { self.prepareDriving() }
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
