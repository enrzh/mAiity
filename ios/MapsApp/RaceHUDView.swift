import SwiftUI

/// Map-overlay race HUD (mirrors web DrivingModePanel) so the sheet can
/// collapse without burying Start / Pause / touch pads.
struct RaceHUDView: View {
    @EnvironmentObject private var model: AppModel

    private var state: AppModel.DrivingState { model.driving }

    var body: some View {
        if case .idle = state {
            EmptyView()
        } else {
            VStack(spacing: 10) {
                statsRow
                actionsRow
                if case .running = state {
                    touchPads
                }
                if case .finished = state {
                    finishedRow
                }
                if case .ready = state {
                    Text(L.t("race-hint"))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                if case .ready = state { history }
                if case .finished = state { history }
            }
            .padding(14)
            .frame(maxWidth: 420)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.28), radius: 18, y: 8)
            .padding(.horizontal, 12)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L.t("race-mode"))
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
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    model.startDriving()
                } label: {
                    Label(L.t("race-start"), systemImage: "play.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
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

    private var history: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(L.t("race-recent"))
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            if model.drivingRuns.isEmpty {
                Text(L.t("race-empty-runs"))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.drivingRuns.prefix(5)) { run in
                    HStack {
                        Text(run.createdAt, style: .date)
                        Spacer()
                        Text(Self.fmtTime(run.duration)).monospacedDigit()
                        Text(Self.fmtDist(run.distanceM)).foregroundStyle(.secondary)
                        Text("\(Int(run.averageSpeedKmh)) km/h")
                            .foregroundStyle(.secondary)
                    }
                    .font(.caption2)
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
