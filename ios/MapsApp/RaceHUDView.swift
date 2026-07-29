import SwiftUI
import UIKit

/// Map-overlay race HUD (mirrors web DrivingModePanel) so the sheet can
/// collapse without burying Start / Pause / touch pads.
struct RaceHUDView: View {
    @EnvironmentObject private var model: AppModel

    private var state: AppModel.DrivingState { model.driving }
    private var countdown: Int? { model.raceCountdown }

    var body: some View {
        if case .idle = state {
            EmptyView()
        } else {
            VStack(spacing: 8) {
                statsRow
                if let c = countdown {
                    Text(c == 0 ? "GO" : "\(c)")
                        .font(.system(size: 32, weight: .heavy, design: .rounded))
                        .foregroundStyle(.mint)
                        .accessibilityLabel("\(L.t("race-countdown")) \(c)")
                }
                // Minimap only at rest — not under touch pads.
                if minimapPath != nil {
                    switch state {
                    case .ready, .paused: minimapView
                    default: EmptyView()
                    }
                }
                actionsRow
                if case .running = state {
                    touchPads
                }
                if case .finished = state {
                    finishedRow
                }
                if case .ready = state, countdown == nil {
                    Text(L.t("race-hint"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
                if case .ready = state, countdown == nil { history }
                if case .finished = state { history }
            }
            .padding(12)
            .frame(maxWidth: 400)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.22), radius: 14, y: 6)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L.t("race-mode"))
            .onChange(of: model.raceCountdown) { _, new in
                guard let new else { return }
                if new <= 0 {
                    model.startDriving()
                    return
                }
                let reduce = UIAccessibility.isReduceMotionEnabled
                DispatchQueue.main.asyncAfter(deadline: .now() + (reduce ? 0.2 : 0.7)) {
                    if model.raceCountdown == new {
                        model.raceCountdown = new - 1
                    }
                }
            }
            .onChange(of: model.driving) { _, new in
                if case .idle = new { model.raceCountdown = nil }
            }
        }
    }

    private var statsRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                Label(L.t("race-mode"), systemImage: "car.fill")
                    .font(.subheadline.bold())
                Spacer(minLength: 0)
                Text("\(Int(model.raceSpeedMps * 3.6)) km/h")
                    .font(.subheadline.monospacedDigit().bold())
                Text(Self.fmtTime(state.elapsed))
                    .font(.subheadline.monospacedDigit().bold())
                Text("\(Int(state.progress * 100))%")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            ProgressView(value: state.progress)
                .tint(.cyan)
        }
    }

    @ViewBuilder
    private var actionsRow: some View {
        HStack(spacing: 8) {
            switch state {
            case .ready:
                if countdown != nil {
                    Button {
                        model.cancelRaceCountdown()
                    } label: {
                        Text(L.t("cancel"))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                } else {
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        model.requestStartRace()
                    } label: {
                        Label(L.t("race-start"), systemImage: "play.fill")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                }
            case .running:
                Button { model.pauseDriving() } label: {
                    Label(L.t("race-pause"), systemImage: "pause.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                Button { model.finishDriving() } label: {
                    Label(L.t("race-finish"), systemImage: "flag.checkered")
                        .frame(minHeight: 44)
                }
                .buttonStyle(.bordered)
            case .paused:
                Button { model.resumeDriving() } label: {
                    Label(L.t("race-resume"), systemImage: "play.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                Button { model.finishDriving() } label: {
                    Label(L.t("race-finish"), systemImage: "flag.checkered")
                        .frame(minHeight: 44)
                }
                .buttonStyle(.bordered)
            case .finished:
                Button { model.resetDriving() } label: {
                    Label(L.t("race-again"), systemImage: "arrow.counterclockwise")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
            case .idle:
                EmptyView()
            }
        }
    }

    private var touchPads: some View {
        HStack(spacing: 8) {
            pad("←", label: L.t("race-left")) {
                model.setRaceSteer($0 ? -1 : 0)
            }
            pad(L.t("race-brake"), label: L.t("race-brake")) {
                model.setRaceBrake($0)
            }
            pad(L.t("race-go"), label: L.t("race-go"), prominent: true) {
                model.setRaceThrottle($0)
            }
            pad("→", label: L.t("race-right")) {
                model.setRaceSteer($0 ? 1 : 0)
            }
        }
    }

    private func pad(
        _ title: String,
        label: String,
        prominent: Bool = false,
        onHold: @escaping (Bool) -> Void
    ) -> some View {
        Text(title)
            .font(.headline.bold())
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(prominent ? Color.accentColor : Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(prominent ? Color.white : Color.primary)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in onHold(true) }
                    .onEnded { _ in onHold(false) }
            )
            .accessibilityLabel(label)
            .accessibilityAddTraits(.isButton)
    }

    private var finishedRow: some View {
        HStack {
            Image(systemName: "flag.checkered")
            Text("\(L.t("race-complete")) · \(Self.fmtTime(state.elapsed))")
                .font(.subheadline.bold())
        }
        .frame(maxWidth: .infinity)
    }

    /// Simple route outline + car dot (parity with web race minimap).
    private var minimapPath: (path: Path, car: CGPoint)? {
        guard let geometry = model.route?.result?.geometry, geometry.count > 1 else { return nil }
        var minX = Double.infinity, minY = Double.infinity
        var maxX = -Double.infinity, maxY = -Double.infinity
        for p in geometry {
            minX = min(minX, p[0]); maxX = max(maxX, p[0])
            minY = min(minY, p[1]); maxY = max(maxY, p[1])
        }
        let w = max(1e-6, maxX - minX)
        let h = max(1e-6, maxY - minY)
        let pad: CGFloat = 0.08
        func to(_ lon: Double, _ lat: Double) -> CGPoint {
            let x = CGFloat((lon - minX) / w) * (1 - 2 * pad) + pad
            let y = 1 - (CGFloat((lat - minY) / h) * (1 - 2 * pad) + pad)
            return CGPoint(x: x, y: y)
        }
        var path = Path()
        for (i, p) in geometry.enumerated() {
            let pt = to(p[0], p[1])
            // Path is in unit space; scale in GeometryReader.
            if i == 0 { path.move(to: pt) } else { path.addLine(to: pt) }
        }
        let car = DrivingPhysics.carPosition(
            progress: state.progress,
            lateral: model.raceLateral,
            geometry: geometry
        )
        return (path, to(car.lon, car.lat))
    }

    private var minimapView: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.black.opacity(0.28))
                if let mini = minimapPath {
                    mini.path
                        .applying(CGAffineTransform(scaleX: size.width, y: size.height))
                        .stroke(Color.cyan.opacity(0.9), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    Circle()
                        .fill(Color.mint)
                        .frame(width: 8, height: 8)
                        .position(
                            x: mini.car.x * size.width,
                            y: mini.car.y * size.height
                        )
                        .overlay(Circle().stroke(Color.white, lineWidth: 1)
                            .frame(width: 8, height: 8)
                            .position(x: mini.car.x * size.width, y: mini.car.y * size.height))
                }
            }
        }
        .frame(height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityHidden(true)
    }

    private var history: some View {
        Group {
            if !model.drivingRuns.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text(L.t("race-recent"))
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                    ForEach(model.drivingRuns.prefix(3)) { run in
                        HStack {
                            Text(run.createdAt, style: .date)
                            Spacer()
                            Text(Self.fmtTime(run.duration)).monospacedDigit()
                            Text(Self.fmtDist(run.distanceM)).foregroundStyle(.secondary)
                        }
                        .font(.caption2)
                    }
                }
            }
        }
    }

    static func fmtTime(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    static func fmtDist(_ m: Double) -> String {
        m >= 1000 ? String(format: "%.1f km", m / 1000) : "\(Int(m)) m"
    }
}
