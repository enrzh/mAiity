import SwiftUI
import UIKit

/// Multi-touch friendly hold control. SwiftUI `DragGesture` only tracks one
/// finger, so Gas + steer fails on real devices. UIButton delivers concurrent
/// touchDown / touchUp for every pad.
struct HoldPadButton: UIViewRepresentable {
    var title: String
    var accessibilityLabel: String
    var prominent: Bool = false
    var onHold: (Bool) -> Void

    func makeUIView(context: Context) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.7
        button.layer.cornerRadius = 12
        button.clipsToBounds = true
        button.isMultipleTouchEnabled = true
        button.accessibilityLabel = accessibilityLabel
        button.accessibilityTraits = .button
        applyStyle(button, pressed: false)

        button.addTarget(context.coordinator, action: #selector(Coordinator.down(_:)), for: .touchDown)
        button.addTarget(context.coordinator, action: #selector(Coordinator.down(_:)), for: .touchDragEnter)
        button.addTarget(context.coordinator, action: #selector(Coordinator.up(_:)), for: .touchUpInside)
        button.addTarget(context.coordinator, action: #selector(Coordinator.up(_:)), for: .touchUpOutside)
        button.addTarget(context.coordinator, action: #selector(Coordinator.up(_:)), for: .touchCancel)
        button.addTarget(context.coordinator, action: #selector(Coordinator.up(_:)), for: .touchDragExit)
        return button
    }

    func updateUIView(_ button: UIButton, context: Context) {
        button.setTitle(title, for: .normal)
        button.accessibilityLabel = accessibilityLabel
        context.coordinator.onHold = onHold
        context.coordinator.prominent = prominent
        if !context.coordinator.holding {
            applyStyle(button, pressed: false)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onHold: onHold, prominent: prominent)
    }

    private func applyStyle(_ button: UIButton, pressed: Bool) {
        if prominent {
            button.backgroundColor = pressed
                ? UIColor.systemBlue.withAlphaComponent(0.75)
                : UIColor.systemBlue
            button.setTitleColor(.white, for: .normal)
        } else {
            button.backgroundColor = pressed
                ? UIColor.secondarySystemFill
                : UIColor.secondarySystemBackground
            button.setTitleColor(.label, for: .normal)
        }
    }

    final class Coordinator: NSObject {
        var onHold: (Bool) -> Void
        var prominent: Bool
        var holding = false

        init(onHold: @escaping (Bool) -> Void, prominent: Bool) {
            self.onHold = onHold
            self.prominent = prominent
        }

        @objc func down(_ sender: UIButton) {
            guard !holding else { return }
            holding = true
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            style(sender, pressed: true)
            onHold(true)
        }

        @objc func up(_ sender: UIButton) {
            guard holding else { return }
            holding = false
            style(sender, pressed: false)
            onHold(false)
        }

        private func style(_ button: UIButton, pressed: Bool) {
            if prominent {
                button.backgroundColor = pressed
                    ? UIColor.systemBlue.withAlphaComponent(0.75)
                    : UIColor.systemBlue
                button.setTitleColor(.white, for: .normal)
            } else {
                button.backgroundColor = pressed
                    ? UIColor.secondarySystemFill
                    : UIColor.secondarySystemBackground
                button.setTitleColor(.label, for: .normal)
            }
        }
    }
}
