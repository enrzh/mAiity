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

    var body: some View {
        MapScreen()
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
