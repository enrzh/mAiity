import SwiftUI

/// Install a custom texture pack: a MapLibre style.json by https URL, or
/// pasted directly. Synced to the account (same packs as the web app).
struct InstallPackSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var source: Source = .url
    @State private var url = ""
    @State private var json = ""
    @State private var busy = false
    @State private var error: String?

    enum Source: String, CaseIterable {
        case url = "Von URL"
        case json = "JSON einfügen"
    }

    private static let errorText: [String: String] = [
        "invalid_name": "Bitte einen Namen (max. 60 Zeichen) angeben.",
        "invalid_url": "Die URL ist ungültig.",
        "url_must_be_https": "Nur https-URLs sind erlaubt.",
        "style_not_json": "Das ist kein gültiges JSON.",
        "style_version_must_be_8": "Der Style muss \"version\": 8 haben.",
        "style_layers_missing": "Dem Style fehlt das \"layers\"-Array.",
        "style_sources_missing": "Dem Style fehlt das \"sources\"-Objekt.",
        "style_too_large": "Der Style ist zu groß (max. 512 KB).",
        "pack_limit_reached": "Maximal 20 eigene Packs.",
    ]

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (source == .url ? url.hasPrefix("https://") : !json.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name (z. B. Neon Nights)", text: $name)
                }
                Section {
                    Picker("Quelle", selection: $source) {
                        ForEach(Source.allCases, id: \.self) { Text($0.rawValue) }
                    }
                    .pickerStyle(.segmented)
                    if source == .url {
                        TextField("https://…/style.json", text: $url)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    } else {
                        TextEditor(text: $json)
                            .font(.system(.caption, design: .monospaced))
                            .frame(height: 160)
                    }
                } footer: {
                    Text("Ein Pack ist ein MapLibre-Style (style.json). Packs können externe Kacheln/Schriften laden — nur aus vertrauenswürdigen Quellen installieren.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }
                Section {
                    Button {
                        submit()
                    } label: {
                        if busy { ProgressView().frame(maxWidth: .infinity) }
                        else { Text("Installieren").frame(maxWidth: .infinity).fontWeight(.semibold) }
                    }
                    .disabled(busy || !valid)
                }
            }
            .navigationTitle("Texture-Pack")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func submit() {
        busy = true
        error = nil
        Task {
            do {
                try await model.installPack(
                    name: name.trimmingCharacters(in: .whitespaces),
                    styleUrl: source == .url ? url.trimmingCharacters(in: .whitespaces) : nil,
                    styleJson: source == .json ? json : nil
                )
                dismiss()
            } catch let e as APIClient.APIError {
                error = Self.errorText[e.code] ?? "Installation fehlgeschlagen — bitte erneut versuchen."
            } catch {
                self.error = "Installation fehlgeschlagen — bitte erneut versuchen."
            }
            busy = false
        }
    }
}
