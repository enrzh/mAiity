import UIKit

/// Single source of truth for the map marker palette + sizes, mirroring the
/// web app's tokens so both platforms draw identical markers.
enum MapTokens {
    // Colors (web: route #3b82f6, poi #0d9488, bookmark #f59e0b, selected #e74c3c)
    static let route = UIColor(hex: 0x3B82F6)
    static let poi = UIColor(hex: 0x0D9488)
    static let bookmark = UIColor(hex: 0xF59E0B)
    static let selected = UIColor(hex: 0xE74C3C)

    /// Size encodes state alongside colour: selected > bookmark > poi.
    static let selectedRadius: Double = 9
    static let bookmarkRadius: Double = 7
    static let poiRadius: Double = 6
    /// Float: LineStyleLayer.lineWidth takes Float (circle radii take Double).
    static let routeWidth: Float = 5

    /// The selected marker gets a wider white ring than the others so colour
    /// is not the only differentiator (colour-vision accessibility).
    static let selectedStrokeWidth: Double = 3
    static let bookmarkStrokeWidth: Double = 2
    static let poiStrokeWidth: Double = 1.5
    static let markerStroke = UIColor.white
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
