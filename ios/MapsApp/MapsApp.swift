import SwiftUI

@main
struct MapsApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
        }
    }
}

/// Full-screen map with the always-presented bottom sheet (Apple-Maps layout).
struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var detent: PresentationDetent = .height(96)
    @State private var sheetShown = true

    /// Height of the sheet for the current detent, so the floating map
    /// controls can sit directly above it and travel with it.
    private var sheetHeight: CGFloat {
        let screen = UIScreen.main.bounds.height
        switch detent {
        case .height(96): return 96
        case .height(220): return 220
        case .medium: return screen * 0.5
        case .large: return screen * 0.92
        default: return 96
        }
    }

    private var raceImmersive: Bool { model.driving.isImmersive }

    var body: some View {
        ZStack(alignment: .bottom) {
            MapScreen(sheetHeight: raceImmersive ? 180 : sheetHeight)
                .ignoresSafeArea()

            if model.mapMovedForCategory, model.activeCategory != nil, !raceImmersive {
                Button {
                    model.searchThisArea()
                } label: {
                    Label(L.t("search-this-area"), systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(.regularMaterial, in: Capsule())
                        .shadow(color: .black.opacity(0.2), radius: 10, y: 4)
                }
                .buttonStyle(.plain)
                .padding(.bottom, max(sheetHeight + 12, 120))
                .transition(.opacity)
            }

            if !isIdle(model.driving) {
                RaceHUDView()
                    .padding(.bottom, raceImmersive ? 28 : max(12, sheetHeight * 0.15))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $sheetShown) {
            SheetView(detent: $detent)
                .presentationDetents(
                    raceImmersive
                        ? [.height(96)]
                        : [.height(96), .height(220), .medium, .large],
                    selection: $detent
                )
                .presentationBackgroundInteraction(.enabled(upThrough: raceImmersive ? .height(96) : .medium))
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled()
                .presentationBackground(.regularMaterial)
                .environmentObject(model)
        }
        .task { await model.boot() }
        .onChange(of: model.selected) { place in
            if place != nil && detent == .height(96) && !raceImmersive {
                detent = .height(220)
            }
        }
        .onChange(of: model.driving) { _, new in
            if new.isImmersive {
                detent = .height(96)
                model.showPackPicker = false
            }
        }
        .animation(.easeOut(duration: 0.25), value: raceImmersive)
    }

    private func isIdle(_ state: AppModel.DrivingState) -> Bool {
        if case .idle = state { return true }
        return false
    }
}
