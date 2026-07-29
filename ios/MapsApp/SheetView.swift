import SwiftUI

/// Apple-Maps-style always-presented bottom sheet. Below the always-visible
/// search field it renders exactly ONE contextual body, using the same
/// precedence chain as the web Shell (App.tsx):
/// nav > route > selected place > saved panel > packs panel > search results
/// > category results > default (categories + recents + secondary actions).
struct SheetView: View {
    @EnvironmentObject private var model: AppModel
    @Binding var detent: PresentationDetent
    @State private var showAuth = false
    @State private var showInstallPack = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                if !model.searchResults.isEmpty {
                    resultsSection
                }
                searchSection
                contextualBody
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(.clear)
        }
        .sheet(isPresented: $showAuth) { AuthSheet() }
        .sheet(isPresented: $showInstallPack) { InstallPackSheet() }
        .sheet(isPresented: $model.showPackPicker) { PackPickerSheet() }
        .onChange(of: searchFocused) { focused in
            if focused { detent = .large }
        }
    }

    /// One thing at a time, like Maps — the web Shell's precedence chain.
    @ViewBuilder
    private var contextualBody: some View {
        if let nav = model.nav {
            navigationSection(nav)
        } else if model.route != nil {
            routeSection
        } else if let place = model.selected {
            placeSection(place)
        } else if model.panel == .saved {
            savedSection
        } else if model.panel == .packs {
            packsSection
        } else if !model.pois.isEmpty {
            poiSection
        } else {
            categorySection
            if model.searchQuery.isEmpty && !model.recents.isEmpty {
                recentsSection
            }
            secondarySection
        }
    }

    // MARK: Search

    private var searchSection: some View {
        Section {
            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField(L.t("search-placeholder"), text: $model.searchQuery)
                    .focused($searchFocused)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit {
                        if let first = model.searchResults.first { pick(first) }
                    }
                if model.searching { ProgressView().controlSize(.small) }
                if !model.searchQuery.isEmpty {
                    Button {
                        model.searchQuery = ""
                        model.searchResults = []
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(L.t("search-clear"))
                }
            }
        }
    }

    private var resultsSection: some View {
        Section(L.t("results")) {
            ForEach(model.searchResults) { r in
                Button { pick(r) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).fontWeight(.semibold)
                        Text(r.label).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var recentsSection: some View {
        Section(L.t("recent-searches")) {
            ForEach(model.recents) { r in
                Button { model.select(result: r); detent = .height(220) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).fontWeight(.medium)
                        Text(r.label).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: POI browsing

    private var categorySection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(NearbyCategory.all) { cat in
                        Button {
                            detent = .medium
                            model.showCategory(cat)
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: cat.symbol)
                                    .font(.footnote)
                                    .foregroundStyle(cat.tint)
                                Text(cat.label).font(.caption).fontWeight(.medium)
                                if model.activeCategory == cat.id {
                                    Image(systemName: "xmark").font(.caption2)
                                }
                            }
                            .padding(.horizontal, 12)
                            .frame(minHeight: 44)
                            .background(
                                Capsule().fill(model.activeCategory == cat.id
                                    ? Color.accentColor.opacity(0.18)
                                    : Color(.secondarySystemBackground))
                            )
                            .overlay(
                                Capsule().strokeBorder(
                                    model.activeCategory == cat.id ? Color.accentColor : .clear,
                                    lineWidth: 1.2)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 2, leading: 12, bottom: 2, trailing: 12))
            .listRowBackground(Color.clear)
        }
    }

    private var poiSection: some View {
        Section {
            ForEach(model.pois) { p in
                Button {
                    let place = Place(name: p.name, label: p.label, lat: p.lat, lon: p.lon)
                    model.selected = place
                    model.cameraTarget = AppModel.CameraEvent(place: place)
                    detent = .height(220)
                } label: {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).fontWeight(.medium)
                            Text(p.label).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        Spacer()
                        if let d = p.distanceM {
                            Text(d >= 1000 ? String(format: "%.1f km", Double(d)/1000) : "\(d) m")
                                .font(.caption2).foregroundStyle(.tertiary).monospacedDigit()
                        }
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Text(L.t("results"))
                Spacer()
                Button {
                    model.clearPois()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44, alignment: .trailing)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L.t("close"))
            }
        }
    }

    // MARK: Navigation

    private func navigationSection(_ nav: AppModel.NavState) -> some View {
        Section {
            let steps = model.route?.result?.steps ?? []
            let next = nav.stepIndex + 1 < steps.count ? steps[nav.stepIndex + 1] : nil
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "location.north.line.fill")
                        .font(.title2).foregroundStyle(.blue)
                    VStack(alignment: .leading, spacing: 3) {
                        if let m = nav.toManeuverM {
                            Text(Self.fmtDist(Int(m))).font(.title.bold()).monospacedDigit()
                        }
                        Text(next?.instruction ?? steps[safe: nav.stepIndex]?.instruction ?? L.t("nav-continue"))
                            .font(.callout)
                    }
                }
                if nav.offRoute {
                    Label(L.t("off-route"), systemImage: "exclamationmark.triangle.fill")
                        .font(.caption).foregroundStyle(.orange)
                }
                HStack {
                    Text(Self.fmtDur(Int(nav.remainingS))).fontWeight(.semibold).monospacedDigit()
                    Spacer()
                    Text(Self.fmtDist(Int(nav.remainingM))).foregroundStyle(.secondary).monospacedDigit()
                }
                .font(.subheadline)

                // Prominent end button — leaving navigation must never require
                // hunting for a small ⨯.
                Button(role: .destructive) {
                    model.stopNavigation()
                } label: {
                    Label(L.t("nav-stop"), systemImage: "xmark.circle.fill")
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .fontWeight(.semibold)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
            }
        }
    }

    // MARK: Routing

    private var routeSection: some View {
        Section {
            if let route = model.route {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        // Start row — tap to re-pick via search or map tap.
                        Button {
                            model.beginPickStart()
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "location.circle")
                                    .font(.caption).foregroundStyle(.secondary)
                                if model.pickingStart {
                                    Text(L.t("route-pick-start"))
                                        .font(.subheadline).foregroundStyle(.blue)
                                } else {
                                    Text(route.from?.name ?? L.t("my-location"))
                                        .font(.subheadline)
                                }
                            }
                            .frame(minHeight: 32, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        HStack(spacing: 6) {
                            Image(systemName: "mappin.circle.fill")
                                .font(.caption).foregroundStyle(.red)
                            Text(route.to.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                        }
                    }
                    Spacer()
                    VStack(spacing: 4) {
                        Button {
                            model.clearRoute()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(L.t("close"))
                        if route.from != nil {
                            Button {
                                model.swapRoute()
                            } label: {
                                Image(systemName: "arrow.up.arrow.down")
                                    .font(.footnote)
                                    .frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(L.t("route-swap"))
                        }
                    }
                }
                Picker("", selection: Binding(
                    get: { route.mode },
                    set: { model.setRouteMode($0) }
                )) {
                    ForEach(RouteMode.allCases, id: \.self) { m in
                        Label(m.label, systemImage: m.symbol).tag(m)
                    }
                }
                .pickerStyle(.segmented)

                switch route.status {
                case .loading:
                    HStack { Spacer(); ProgressView(L.t("route-loading")); Spacer() }
                case .error:
                    Text(route.errorText ?? L.t("err-unknown")).foregroundStyle(.red).font(.footnote)
                case .ready:
                    if let r = route.result {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(Self.fmtDur(r.durationS)).font(.title3.bold())
                            Text(Self.fmtDist(r.distanceM)).foregroundStyle(.secondary)
                        }
                        Button {
                            model.startNavigation()
                            detent = .height(220)
                        } label: {
                            Label(L.t("nav-start"), systemImage: "location.north.line.fill")
                                .frame(maxWidth: .infinity, minHeight: 32).fontWeight(.semibold)
                        }
                        .buttonStyle(.borderedProminent)
                        if route.mode == .car {
                            drivingSection
                        }
                        ForEach(Array(r.steps.enumerated()), id: \.offset) { i, step in
                            HStack(alignment: .top, spacing: 10) {
                                Text("\(i + 1)")
                                    .font(.caption2.bold())
                                    .frame(width: 20, height: 20)
                                    .background(Circle().fill(Color(.secondarySystemBackground)))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(step.instruction).font(.subheadline)
                                    if step.distanceM > 0 {
                                        Text(Self.fmtDist(step.distanceM)).font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private var drivingSection: some View {
        let state = model.driving
        // Full controls live in RaceHUDView (map overlay). Sheet keeps a short entry.
        return VStack(alignment: .leading, spacing: 8) {
            Label(L.t("race-mode"), systemImage: "car.fill")
                .font(.subheadline.bold())
            HStack(spacing: 8) {
                switch state {
                case .ready:
                    Button(L.t("race-start")) { model.requestStartRace() }
                        .buttonStyle(.borderedProminent)
                case .running, .paused:
                    Text(L.t("race-active-hint"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                case .finished:
                    Button(L.t("race-again")) { model.resetDriving() }
                        .buttonStyle(.borderedProminent)
                case .idle:
                    EmptyView()
                }
            }
        }
        .padding(.vertical, 6)
    }

    static func fmtDist(_ m: Int) -> String {
        m >= 1000 ? String(format: "%.1f km", Double(m) / 1000) : "\(m) m"
    }
    static func fmtDur(_ s: Int) -> String {
        let min = Int((Double(s) / 60).rounded())
        return min < 60 ? "\(min) min" : "\(min / 60) h \(min % 60) min"
    }
    static func fmtTime(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    // MARK: Selected place

    private func placeSection(_ place: Place) -> some View {
        Section {
            HStack(alignment: .top, spacing: 4) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(place.name).font(.headline)
                    Text(place.label).font(.footnote).foregroundStyle(.secondary)
                    Text(String(format: "%.5f, %.5f", place.lat, place.lon))
                        .font(.caption2).foregroundStyle(.tertiary)
                }
                Spacer()
                Button {
                    model.startRoute(to: place)
                    detent = .medium
                } label: {
                    Image(systemName: "arrow.triangle.turn.up.right.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.blue)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L.t("route-to-here"))
                ShareLink(
                    item: URL(string: "https://maps.aiity.de/maps/?p=\(String(format: "%.5f,%.5f", place.lat, place.lon)),\(place.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!,
                    subject: Text(place.name)
                ) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L.t("share-place"))
                Button {
                    Task {
                        let ok = await model.toggleBookmark(place)
                        if !ok { showAuth = true }
                    }
                } label: {
                    Image(systemName: model.bookmarkFor(place) != nil ? "star.fill" : "star")
                        .font(.title2)
                        .foregroundStyle(.yellow)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L.t(model.bookmarkFor(place) != nil ? "saved-remove" : "save-place"))
                Button {
                    model.selected = nil
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L.t("close"))
            }
        }
    }

    // MARK: Saved panel

    private var savedSection: some View {
        Section {
            if model.user == nil {
                Button(L.t("saved-signin-hint")) { showAuth = true }
                    .frame(minHeight: 44, alignment: .leading)
            } else if model.bookmarks.isEmpty {
                Text(L.t("saved-empty")).foregroundStyle(.secondary)
            } else {
                ForEach(model.bookmarks) { b in
                    Button {
                        model.select(bookmark: b)
                        detent = .height(220)
                    } label: {
                        HStack {
                            Image(systemName: "star.fill").foregroundStyle(.yellow)
                            Text(b.name)
                            Spacer()
                            Text(String(format: "%.3f, %.3f", b.lat, b.lon))
                                .font(.caption2).foregroundStyle(.tertiary)
                        }
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                }
                .onDelete { idx in
                    let ids = idx.map { model.bookmarks[$0].id }
                    Task { for id in ids { await model.removeBookmark(id) } }
                }
            }
        } header: {
            panelHeader(L.t("saved-places"))
        }
    }

    // MARK: Packs panel

    private var packsSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(model.allPacks) { pack in
                        Button { model.setPack(pack.id) } label: {
                            VStack(spacing: 6) {
                                if let colors = pack.preview?.colors, !colors.isEmpty {
                                    HStack(spacing: 3) {
                                        ForEach(colors.prefix(3), id: \.self) { hex in
                                            Circle().fill(Color(hex: hex)).frame(width: 14, height: 14)
                                        }
                                    }
                                } else {
                                    Image(systemName: "paintpalette")
                                        .font(.system(size: 13))
                                        .foregroundStyle(.secondary)
                                        .frame(height: 14)
                                }
                                Text(pack.name).font(.caption).fontWeight(.medium).lineLimit(1)
                            }
                            .padding(.horizontal, 14)
                            .frame(minHeight: 48)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(model.activePackId == pack.id ? Color.accentColor.opacity(0.18) : Color(.secondarySystemBackground))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(model.activePackId == pack.id ? Color.accentColor : .clear, lineWidth: 1.5)
                            )
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            if pack.isCustom {
                                Button(role: .destructive) {
                                    Task { await model.removePack(pack.id) }
                                } label: {
                                    Label(L.t("delete"), systemImage: "trash")
                                }
                            }
                        }
                    }

                    // Install-your-own — the texture-pack feature.
                    Button {
                        if model.user == nil { showAuth = true } else { showInstallPack = true }
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: "plus")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(height: 14)
                            Text(L.t("install")).font(.caption).fontWeight(.medium)
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                                .foregroundStyle(.secondary)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        } header: {
            panelHeader(L.t("map-style"))
        }
    }

    /// Panel title row with a close/back affordance (web panels have onClose).
    private func panelHeader(_ title: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Button {
                model.panel = .none
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .frame(width: 44, height: 44, alignment: .trailing)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(L.t("close"))
        }
    }

    // MARK: Default state secondary actions

    /// One compact row: saved places, map style, and a "More" menu holding
    /// account + language — mirrors the web rail controls without stacking
    /// permanent sections into the sheet.
    private var secondarySection: some View {
        Section {
            HStack(spacing: 10) {
                secondaryButton(symbol: "star", title: L.t("saved-places")) {
                    model.panel = .saved
                    if detent == .height(96) { detent = .medium }
                }
                secondaryButton(symbol: "paintpalette", title: L.t("map-style")) {
                    model.panel = .packs
                    if detent == .height(96) { detent = .medium }
                }
                moreMenu
            }
            .listRowInsets(EdgeInsets(top: 2, leading: 12, bottom: 2, trailing: 12))
            .listRowBackground(Color.clear)
        }
    }

    private func secondaryButton(symbol: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            secondaryLabel(symbol: symbol, title: title)
        }
        .buttonStyle(.plain)
    }

    private var moreMenu: some View {
        Menu {
            if let user = model.user {
                Section(user.displayName ?? user.email ?? L.t("account")) {
                    Button(role: .destructive) {
                        Task { await model.logout() }
                    } label: {
                        Label(L.t("sign-out"), systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            } else {
                Button {
                    showAuth = true
                } label: {
                    Label(L.t("sign-in"), systemImage: "person.crop.circle")
                }
            }
            Picker(selection: Binding(get: { model.lang }, set: { model.setLang($0) })) {
                ForEach(L.languages) { l in
                    Text(l.name).tag(l.id)
                }
            } label: {
                Label(L.t("language"), systemImage: "globe")
            }
            .pickerStyle(.menu)
        } label: {
            secondaryLabel(symbol: "ellipsis.circle", title: L.t("more"))
        }
        .accessibilityLabel(L.t("more"))
    }

    private func secondaryLabel(symbol: String, title: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.accentColor)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, minHeight: 56)
        .background(
            RoundedRectangle(cornerRadius: 14).fill(Color(.secondarySystemBackground))
        )
        .contentShape(RoundedRectangle(cornerRadius: 14))
    }

    private func pick(_ r: GeoResult) {
        model.select(result: r)
        // Quiet write — a normal assignment would re-trigger the debounced
        // search and pop the results list back open 350ms later.
        model.setQueryQuietly(r.name)
        searchFocused = false
        detent = .height(220)
    }
}

extension Color {
    /// "#rrggbb" → Color (pack preview swatches).
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
        self.init(
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255
        )
    }
}
