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
/// Race mode hides the sheet so HUD + map controls don't fight for the bottom.
struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var detent: PresentationDetent = .height(96)
    @State private var sheetShown = true

    private var sheetHeight: CGFloat {
        if raceImmersive { return 0 }
        let screen = UIScreen.main.bounds.height
        switch detent {
        case .height(96): return 96
        case .height(220): return 220
        case .medium: return screen * 0.5
        case .large: return screen * 0.92
        default: return 96
        }
    }

    private var raceImmersive: Bool {
        switch model.driving {
        case .idle: return false
        default: return true
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            MapScreen(sheetHeight: raceImmersive ? 168 : sheetHeight)
                .ignoresSafeArea()

            // Search-this-area: TOP centre — never bottom (HUD / sheet zone).
            if model.mapMovedForCategory, model.activeCategory != nil, !raceImmersive {
                VStack {
                    Button {
                        model.searchThisArea()
                    } label: {
                        Label(L.t("search-this-area"), systemImage: "arrow.clockwise")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(.regularMaterial, in: Capsule())
                            .shadow(color: .black.opacity(0.18), radius: 8, y: 3)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .transition(.opacity)
            }

            if raceImmersive {
                RaceHUDView()
                    .padding(.horizontal, 10)
                    .padding(.bottom, 10)
                    .safeAreaPadding(.bottom, 4)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(isPresented: Binding(
            get: { sheetShown && !raceImmersive },
            set: { sheetShown = $0 || raceImmersive }
        )) {
            SheetView(detent: $detent)
                .presentationDetents([.height(96), .height(220), .medium, .large], selection: $detent)
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
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
            switch new {
            case .idle:
                sheetShown = true
                detent = .height(96)
            default:
                model.showPackPicker = false
            }
        }
        .animation(.easeOut(duration: 0.22), value: raceImmersive)
    }
}
