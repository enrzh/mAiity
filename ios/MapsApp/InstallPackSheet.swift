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

    enum Source: CaseIterable {
        case url, json

        var label: String { L.t(self == .url ? "tab-from-url" : "tab-paste-json") }
    }

    /// Server error code → localization key.
    private static let errorKeys: [String: String] = [
        "invalid_name": "err-invalid-name",
        "invalid_url": "err-invalid-url",
        "url_must_be_https": "err-url-https",
        "style_not_json": "err-style-not-json",
        "style_version_must_be_8": "err-style-version",
        "style_layers_missing": "err-style-layers",
        "style_sources_missing": "err-style-sources",
        "style_too_large": "err-style-too-large",
        "pack_limit_reached": "err-pack-limit",
    ]

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (source == .url ? url.hasPrefix("https://") : !json.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(L.t("name")) {
                    TextField(L.t("pack-install-name-placeholder"), text: $name)
                }
                Section {
                    Picker("", selection: $source) {
                        ForEach(Source.allCases, id: \.self) { Text($0.label) }
                    }
                    .pickerStyle(.segmented)
                    if source == .url {
                        TextField("https://…/style.json", text: $url)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .accessibilityLabel(L.t("style-url-label"))
                    } else {
                        TextEditor(text: $json)
                            .font(.system(.caption, design: .monospaced))
                            .frame(height: 160)
                            .accessibilityLabel(L.t("style-json-label"))
                    }
                } footer: {
                    Text(L.t("pack-install-hint"))
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }
                Section {
                    Button {
                        submit()
                    } label: {
                        if busy { ProgressView().frame(maxWidth: .infinity) }
                        else { Text(L.t("install")).frame(maxWidth: .infinity).fontWeight(.semibold) }
                    }
                    .disabled(busy || !valid)
                }
            }
            .navigationTitle(L.t("pack-install-title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L.t("cancel")) { dismiss() }
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
                error = L.t(Self.errorKeys[e.code] ?? "pack-install-failed")
            } catch {
                self.error = L.t("pack-install-failed")
            }
            busy = false
        }
    }
}
