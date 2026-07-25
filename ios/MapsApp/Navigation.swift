import CoreLocation
import Foundation

/// Navigation maths, mirroring web/src/lib/navigation.ts so both platforms
/// behave identically. Coordinates are [lon, lat] to match route geometry.
enum Nav {
    static let earthRadius = 6_371_000.0
    /// Off-route threshold — generous enough for GPS noise and wide roads.
    static let offRouteM = 45.0

    static func distance(_ a: (lon: Double, lat: Double), _ b: (lon: Double, lat: Double)) -> Double {
        let lat = ((a.lat + b.lat) / 2) * .pi / 180
        let x = ((b.lon - a.lon) * .pi / 180) * cos(lat)
        let y = (b.lat - a.lat) * .pi / 180
        return (x * x + y * y).squareRoot() * earthRadius
    }

    /// Compass bearing a→b in degrees (0 = north) for the follow camera.
    static func bearing(_ a: (lon: Double, lat: Double), _ b: (lon: Double, lat: Double)) -> Double {
        let f1 = a.lat * .pi / 180, f2 = b.lat * .pi / 180
        let dl = (b.lon - a.lon) * .pi / 180
        let y = sin(dl) * cos(f2)
        let x = cos(f1) * sin(f2) - sin(f1) * cos(f2) * cos(dl)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }

    private static func pointToSegment(
        _ p: (lon: Double, lat: Double),
        _ a: (lon: Double, lat: Double),
        _ b: (lon: Double, lat: Double)
    ) -> (d: Double, t: Double) {
        let scale = cos(p.lat * .pi / 180)
        let ax = a.lon * scale, ay = a.lat
        let bx = b.lon * scale, by = b.lat
        let px = p.lon * scale, py = p.lat
        let dx = bx - ax, dy = by - ay
        let len2 = dx * dx + dy * dy
        let t = len2 == 0 ? 0 : max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        let cx = ax + t * dx, cy = ay + t * dy
        let ddx = (px - cx) / scale, ddy = py - cy
        let d = ((ddx * scale) * (ddx * scale) + ddy * ddy).squareRoot() * (.pi / 180) * earthRadius
        return (d, t)
    }

    struct Snapped {
        var index: Int
        var offRouteM: Double
        var remainingM: Double
    }

    /// Snap a live position onto the route. Searching forward from the last
    /// index keeps this cheap and stops self-crossing routes from rewinding.
    static func snap(
        position: (lon: Double, lat: Double),
        geometry: [[Double]],
        from: Int = 0,
        window: Int = 400
    ) -> Snapped {
        guard geometry.count >= 2 else { return Snapped(index: 0, offRouteM: 0, remainingM: 0) }
        var best = (d: Double.infinity, i: from, t: 0.0)
        let end = min(geometry.count - 1, from + window)
        var i = max(0, from)
        while i < end {
            let a = (lon: geometry[i][0], lat: geometry[i][1])
            let b = (lon: geometry[i + 1][0], lat: geometry[i + 1][1])
            let r = pointToSegment(position, a, b)
            if r.d < best.d { best = (r.d, i, r.t) }
            i += 1
        }
        var remaining = distance(
            (geometry[best.i][0], geometry[best.i][1]),
            (geometry[best.i + 1][0], geometry[best.i + 1][1])
        ) * (1 - best.t)
        var j = best.i + 1
        while j < geometry.count - 1 {
            remaining += distance(
                (geometry[j][0], geometry[j][1]),
                (geometry[j + 1][0], geometry[j + 1][1])
            )
            j += 1
        }
        return Snapped(index: best.i, offRouteM: best.d, remainingM: remaining)
    }

    /// Which step is being driven, given progress along the geometry.
    static func currentStep(_ steps: [RouteStep], index: Int) -> Int {
        var s = 0
        for (i, step) in steps.enumerated() where step.beginIdx <= index { s = i }
        return s
    }

    /// Metres from the user to the start of the next maneuver.
    static func metresToManeuver(
        geometry: [[Double]], index: Int,
        position: (lon: Double, lat: Double), nextBeginIdx: Int
    ) -> Double {
        guard nextBeginIdx > index, geometry.count > 1 else { return 0 }
        let firstIdx = min(index + 1, geometry.count - 1)
        var m = distance(position, (geometry[firstIdx][0], geometry[firstIdx][1]))
        var i = index + 1
        while i < min(nextBeginIdx, geometry.count - 1) {
            m += distance((geometry[i][0], geometry[i][1]), (geometry[i + 1][0], geometry[i + 1][1]))
            i += 1
        }
        return m
    }
}

extension Array {
    /// Bounds-safe lookup for step indices that may momentarily run ahead.
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
