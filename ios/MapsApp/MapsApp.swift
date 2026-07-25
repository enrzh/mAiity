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

    var body: some View {
        MapScreen(sheetHeight: sheetHeight)
            .sheet(isPresented: $sheetShown) {
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
                // Surface the place card when something is selected from the map.
                if place != nil && detent == .height(96) { detent = .height(220) }
            }
    }
}
