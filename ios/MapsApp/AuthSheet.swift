import SwiftUI
import AuthenticationServices

enum AppConfig {
    /// Sign in with Apple needs the paid Apple Developer Program — personal
    /// teams can't sign the entitlement. Flip this (and re-add the
    /// entitlement in project.yml) once a paid membership is active.
    static let signInWithAppleEnabled = false
}

/// Login/registration: Sign in with Apple (native) + email/password.
struct AuthSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false

    enum Mode: CaseIterable {
        case login, register

        var label: String { L.t(self == .login ? "sign-in" : "register") }
    }

    var body: some View {
        NavigationStack {
            Form {
                if AppConfig.signInWithAppleEnabled {
                    Section {
                        SignInWithAppleButton(.signIn) { request in
                            request.requestedScopes = [.fullName, .email]
                        } onCompletion: { result in
                            handleApple(result)
                        }
                        .signInWithAppleButtonStyle(.black)
                        .frame(height: 48)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }

                Section {
                    Picker("", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.label) }
                    }
                    .pickerStyle(.segmented)

                    TextField(L.t("email"), text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                    SecureField(L.t("password-min8"), text: $password)
                        .textContentType(mode == .login ? .password : .newPassword)

                    if let error = model.authError {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }

                    Button {
                        submit()
                    } label: {
                        if busy { ProgressView().frame(maxWidth: .infinity) }
                        else { Text(mode.label).frame(maxWidth: .infinity).fontWeight(.semibold) }
                    }
                    .disabled(busy || email.isEmpty || password.count < 8)
                }
            }
            .navigationTitle(L.t("account"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L.t("cancel")) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { model.authError = nil }
    }

    private func submit() {
        busy = true
        Task {
            let ok = mode == .login
                ? await model.login(email: email, password: password)
                : await model.register(email: email, password: password)
            busy = false
            if ok { dismiss() }
        }
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        guard case .success(let auth) = result,
              let credential = auth.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else { return }
        // Name is only delivered on the FIRST authorization — pass it along.
        let name = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }.joined(separator: " ")
        busy = true
        Task {
            let ok = await model.signInWithApple(identityToken: token, fullName: name.isEmpty ? nil : name)
            busy = false
            if ok { dismiss() }
        }
    }
}
