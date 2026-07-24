import SwiftUI

/// Apple-Maps-style always-presented bottom sheet: search, results, selected
/// place, saved places, packs, account.
struct SheetView: View {
    @EnvironmentObject private var model: AppModel
    @Binding var detent: PresentationDetent
    @State private var showAuth = false
    @State private var showInstallPack = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                searchSection
                if model.route == nil { categorySection }
                if model.route != nil { routeSection }
                if let place = model.selected { placeSection(place) }
                if !model.searchResults.isEmpty { resultsSection }
                if model.searchQuery.isEmpty && model.searchResults.isEmpty
                    && !model.recents.isEmpty && model.route == nil && model.selected == nil {
                    recentsSection
                }
                if !model.pois.isEmpty && model.route == nil { poiSection }
                savedSection
                packsSection
                accountSection
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(.clear)
        }
        .sheet(isPresented: $showAuth) { AuthSheet() }
        .sheet(isPresented: $showInstallPack) { InstallPackSheet() }
        .onChange(of: searchFocused) { focused in
            if focused { detent = .large }
        }
    }

    // MARK: Sections

    private var searchSection: some View {
        Section {
            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Ort, Adresse suchen …", text: $model.searchQuery)
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
                    } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var resultsSection: some View {
        Section("Ergebnisse") {
            ForEach(model.searchResults) { r in
                Button { pick(r) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).fontWeight(.semibold)
                        Text(r.label).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var recentsSection: some View {
        Section("Zuletzt gesucht") {
            ForEach(model.recents) { r in
                Button { model.select(result: r); detent = .height(220) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).fontWeight(.medium)
                        Text(r.label).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
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
                            Task { await model.showCategory(cat) }
                        } label: {
                            HStack(spacing: 4) {
                                Text(cat.emoji)
                                Text(cat.label).font(.caption).fontWeight(.medium)
                                if model.activeCategory == cat.id {
                                    Image(systemName: "xmark").font(.caption2)
                                }
                            }
                            .padding(.vertical, 7).padding(.horizontal, 11)
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
            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
        }
    }

    private var poiSection: some View {
        Section("In der Nähe") {
            ForEach(model.pois) { p in
                Button {
                    model.selected = Place(name: p.name, label: p.label, lat: p.lat, lon: p.lon)
                    model.cameraTarget = model.selected
                    detent = .height(220)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.name).fontWeight(.medium)
                        Text(p.label).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
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
                                    Text("Startpunkt wählen: suchen oder Karte antippen …")
                                        .font(.subheadline).foregroundStyle(.blue)
                                } else {
                                    Text(route.from?.name ?? "Mein Standort")
                                        .font(.subheadline)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        HStack(spacing: 6) {
                            Image(systemName: "mappin.circle.fill")
                                .font(.caption).foregroundStyle(.red)
                            Text(route.to.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                        }
                    }
                    Spacer()
                    VStack(spacing: 10) {
                        Button {
                            model.clearRoute()
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        if route.from != nil {
                            Button {
                                model.swapRoute()
                            } label: {
                                Image(systemName: "arrow.up.arrow.down").font(.footnote)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Start und Ziel tauschen")
                        }
                    }
                }
                Picker("Modus", selection: Binding(
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
                    HStack { Spacer(); ProgressView("Route wird berechnet …"); Spacer() }
                case .error:
                    Text(route.errorText ?? "Fehler").foregroundStyle(.red).font(.footnote)
                case .ready:
                    if let r = route.result {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(Self.fmtDur(r.durationS)).font(.title3.bold())
                            Text(Self.fmtDist(r.distanceM)).foregroundStyle(.secondary)
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

    static func fmtDist(_ m: Int) -> String {
        m >= 1000 ? String(format: "%.1f km", Double(m) / 1000) : "\(m) m"
    }
    static func fmtDur(_ s: Int) -> String {
        let min = Int((Double(s) / 60).rounded())
        return min < 60 ? "\(min) min" : "\(min / 60) h \(min % 60) min"
    }

    private func placeSection(_ place: Place) -> some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
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
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Route hierhin")
                ShareLink(
                    item: URL(string: "https://privatenas.nl/maps/?p=\(String(format: "%.5f,%.5f", place.lat, place.lon)),\(place.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!,
                    subject: Text(place.name)
                ) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ort teilen")
                Button {
                    Task {
                        let ok = await model.toggleBookmark(place)
                        if !ok { showAuth = true }
                    }
                } label: {
                    Image(systemName: model.bookmarkFor(place) != nil ? "star.fill" : "star")
                        .font(.title2)
                        .foregroundStyle(.yellow)
                }
                .buttonStyle(.plain)
                Button {
                    model.selected = nil
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var savedSection: some View {
        Section("Gespeicherte Orte") {
            if model.user == nil {
                Button("Anmelden, um Orte zu speichern") { showAuth = true }
            } else if model.bookmarks.isEmpty {
                Text("Noch nichts gespeichert.").foregroundStyle(.secondary)
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
                    }
                    .buttonStyle(.plain)
                }
                .onDelete { idx in
                    let ids = idx.map { model.bookmarks[$0].id }
                    Task { for id in ids { await model.removeBookmark(id) } }
                }
            }
        }
    }

    private var packsSection: some View {
        Section("Karten-Stil") {
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
                            .padding(.vertical, 8).padding(.horizontal, 14)
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
                                    Label("Pack entfernen", systemImage: "trash")
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
                            Text("Installieren").font(.caption).fontWeight(.medium)
                        }
                        .padding(.vertical, 8).padding(.horizontal, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                                .foregroundStyle(.secondary)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var accountSection: some View {
        Section {
            if let user = model.user {
                HStack {
                    Image(systemName: "person.crop.circle.fill").font(.title2).foregroundStyle(.blue)
                    VStack(alignment: .leading) {
                        Text(user.displayName ?? user.email ?? "Konto").fontWeight(.medium)
                        if user.displayName != nil, let email = user.email {
                            Text(email).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Button("Abmelden", role: .destructive) {
                        Task { await model.logout() }
                    }
                }
            } else {
                Button {
                    showAuth = true
                } label: {
                    Label("Anmelden oder registrieren", systemImage: "person.crop.circle")
                }
            }
        }
    }

    private func pick(_ r: GeoResult) {
        model.select(result: r)
        model.searchQuery = r.name
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
