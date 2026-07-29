import SwiftUI
import UIKit

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

/// Full-screen map with Apple-Maps-style bottom sheet.
struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var detent: PresentationDetent = .height(96)
    @State private var sheetShown = true

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
        ZStack(alignment: .bottom) {
            MapScreen(sheetHeight: sheetHeight)
                .ignoresSafeArea()

            if model.mapMovedForCategory, model.activeCategory != nil {
                VStack {
                    Button {
                        model.searchThisArea()
                    } label: {
                        Label(L.t("search-this-area"), systemImage: "arrow.clockwise")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(.regularMaterial, in: Capsule())
                            .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .sheet(isPresented: $sheetShown) {
            SheetView(detent: $detent)
                .presentationDetents([.height(96), .height(220), .medium, .large], selection: $detent)
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationDragIndicator(.visible)
                .interactiveDismissDisabled()
                .presentationBackground(.ultraThinMaterial)
                .presentationCornerRadius(20)
                .environmentObject(model)
        }
        .task { await model.boot() }
        .onChange(of: model.selected) { place in
            if place != nil && detent == .height(96) {
                detent = .height(220)
            }
        }
    }
}
