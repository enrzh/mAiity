import UIKit

/// App-wide orientation gate. Maps stays portrait; driving game forces landscape.
enum OrientationLock {
    /// Default: portrait for browsing. Landscape only while driving game is armed.
    static var mask: UIInterfaceOrientationMask = .portrait

    static func setDriving(_ driving: Bool) {
        mask = driving ? .landscape : .portrait
        apply()
    }

    static func apply() {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first
        else { return }

        // Prefer modern geometry update (iOS 16+), then fall back to rotation notify.
        if #available(iOS 16.0, *) {
            let prefs = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: mask)
            scene.requestGeometryUpdate(prefs) { _ in
                // Geometry may fail mid-transition; still refresh controller support.
                refreshControllers()
            }
        }
        refreshControllers()
    }

    private static func refreshControllers() {
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows {
                window.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            }
        }
    }
}

/// Required so `UIApplicationDelegate.supportedInterfaceOrientationsFor` can gate rotation.
final class OrientationAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        OrientationLock.mask
    }
}
