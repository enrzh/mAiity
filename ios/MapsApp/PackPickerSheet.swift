import SwiftUI

/// Texture-pack picker opened from the floating map button.
struct PackPickerSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var showInstall = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Kartenanbieter", selection: Binding(
                        get: { model.activePackId == "light" ? "apple" : "custom" },
                        set: { provider in
                            if provider == "apple" {
                                model.setAppleProvider()
                            } else {
                                let fallback = model.allPacks.first(where: { $0.id != "light" })?.id ?? "dark"
                                model.setPack(fallback)
                            }
                        }
                    )) {
                        Text("Apple Maps").tag("apple")
                        Text("Eigene Stile").tag("custom")
                    }
                    .pickerStyle(.segmented)
                }

                if model.activePackId == "light" {
                    Section {
                        Picker("Kartentyp", selection: $model.appleMapType) {
                            Text("Standard").tag("standard")
                            Text("Satellit").tag("satellite")
                            Text("Hybrid").tag("hybrid")
                        }
                        Picker("Darstellung", selection: $model.appleColorScheme) {
                            Text("Automatisch").tag("adaptive")
                            Text("Hell").tag("light")
                            Text("Dunkel").tag("dark")
                        }
                    } header: {
                        Text("Apple Maps")
                    } footer: {
                        Text("Apple-Kartendaten bleiben vollständig interaktiv. Eigene Stile verwenden den separaten Kartenmodus.")
                    }
                } else {
                    Section {
                    ForEach(model.allPacks.filter { $0.id != "light" }) { pack in
                        Button {
                            model.setPack(pack.id)
                        } label: {
                            HStack(spacing: 12) {
                                if let colors = pack.preview?.colors, !colors.isEmpty {
                                    HStack(spacing: 3) {
                                        ForEach(colors.prefix(3), id: \.self) { hex in
                                            Circle().fill(Color(hex: hex)).frame(width: 16, height: 16)
                                        }
                                    }
                                } else {
                                    Image(systemName: "paintpalette").foregroundStyle(.secondary)
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(pack.name).fontWeight(.medium)
                                    Text(pack.description).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if model.activePackId == pack.id {
                                    Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .swipeActions {
                            if pack.isCustom {
                                Button(role: .destructive) {
                                    Task { await model.removePack(pack.id) }
                                } label: { Label(L.t("delete"), systemImage: "trash") }
                            }
                        }
                    }
                    } header: {
                        Text("Eigene Stile")
                    }
                Section {
                    Button {
                        showInstall = true
                    } label: {
                        Label(L.t("pack-install-title"), systemImage: "plus")
                    }
                    .disabled(model.user == nil)
                } header: {
                    Text("Stile verwalten")
                } footer: {
                    if model.user == nil {
                        Text(L.t("packs-signin-hint"))
                    }
                }
                }
            }
            .navigationTitle(L.t("map-style"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(L.t("done")) { dismiss() }
                }
            }
            .sheet(isPresented: $showInstall) { InstallPackSheet() }
        }
        .presentationDetents([.medium, .large])
    }
}
