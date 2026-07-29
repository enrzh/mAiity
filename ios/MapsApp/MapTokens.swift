import SwiftUI
import UIKit

/// Single source of truth for markers + chrome styling (mirrors web tokens).
enum MapTokens {
    // Colors (web: route primary blue, poi teal, bookmark amber, selected red)
    static let route = UIColor(hex: 0x3B82F6)
    static let poi = UIColor(hex: 0x0D9488)
    static let bookmark = UIColor(hex: 0xF59E0B)
    static let selected = UIColor(hex: 0xE74C3C)

    /// Size encodes state alongside colour: selected > bookmark > poi.
    static let selectedRadius: Double = 9
    static let bookmarkRadius: Double = 7
    static let poiRadius: Double = 6
    static let routeWidth: Float = 5

    static let selectedStrokeWidth: Double = 3
    static let bookmarkStrokeWidth: Double = 2
    static let poiStrokeWidth: Double = 1.5
    static let markerStroke = UIColor.white

    // Minimal chrome (aligned with web Surface)
    static let chromeCorner: CGFloat = 20
    static let controlHeight: CGFloat = 40
    static let fabSize: CGFloat = 44
}

/// Soft glass fill for floating map chrome.
struct MapsChromeBackground: ViewModifier {
    var pill = false
    func body(content: Content) -> some View {
        content
            .background {
                if pill {
                    Capsule().fill(.ultraThinMaterial)
                } else {
                    RoundedRectangle(cornerRadius: MapTokens.chromeCorner, style: .continuous)
                        .fill(.ultraThinMaterial)
                }
            }
            .overlay {
                if pill {
                    Capsule().strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5)
                } else {
                    RoundedRectangle(cornerRadius: MapTokens.chromeCorner, style: .continuous)
                        .strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5)
                }
            }
    }
}

extension View {
    func mapsChrome(pill: Bool = false) -> some View {
        modifier(MapsChromeBackground(pill: pill))
    }
}

extension UIColor {
    /// 0xRRGGBB → opaque UIColor.
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
