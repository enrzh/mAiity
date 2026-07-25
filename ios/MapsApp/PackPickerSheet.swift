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
                    ForEach(model.allPacks) { pack in
                        Button {
                            model.setPack(pack.id)
                            dismiss()
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
                                } label: { Label("Löschen", systemImage: "trash") }
                            }
                        }
                    }
                }
                Section {
                    Button {
                        showInstall = true
                    } label: {
                        Label("Texture-Pack installieren", systemImage: "plus")
                    }
                    .disabled(model.user == nil)
                } footer: {
                    if model.user == nil {
                        Text("Zum Installieren eigener Packs anmelden.")
                    }
                }
            }
            .navigationTitle("Karten-Stil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
            .sheet(isPresented: $showInstall) { InstallPackSheet() }
        }
        .presentationDetents([.medium, .large])
    }
}
