import Foundation

/// Mirrors `web/src/lib/drivingGame.ts` so race feel matches web.
struct DrivingInput: Equatable {
    var throttle = false
    var brake = false
    /// -1 = left, 0 = center, 1 = right
    var steer: Double = 0
}

struct DrivingPhysicsState: Equatable {
    var progress: Double
    var speedMps: Double
    var lateral: Double
}

enum DrivingPhysics {
    /// Lane half-width scale for lateral ∈ [-1, 1] (metres).
    static let laneM = 3.2

    static func step(
        _ state: DrivingPhysicsState,
        input: DrivingInput,
        dt: TimeInterval,
        distanceM: Double
    ) -> DrivingPhysicsState {
        let safeDt = min(max(dt, 0), 0.1)
        let acceleration: Double = input.brake ? -14 : (input.throttle ? 10 : -3)
        let speedMps = max(0, min(55, state.speedMps + acceleration * safeDt))
        let lateral = max(-1, min(1, state.lateral + input.steer * safeDt * (0.8 + speedMps / 35)))
        let progress = min(1, state.progress + (speedMps * safeDt) / max(1, distanceM))
        return DrivingPhysicsState(progress: progress, speedMps: speedMps, lateral: lateral)
    }

    /// Distance-based point along geometry (progress 0…1).
    static func point(at progress: Double, geometry: [[Double]]) -> (lon: Double, lat: Double) {
        guard geometry.count >= 2 else {
            let p = geometry.first ?? [0, 0]
            return (p[0], p[1])
        }
        let clamped = max(0, min(1, progress))
        var total = 0.0
        var segs: [(Double, (Double, Double), (Double, Double))] = []
        for i in 1..<geometry.count {
            let a = (geometry[i - 1][0], geometry[i - 1][1])
            let b = (geometry[i][0], geometry[i][1])
            let d = Nav.distance((a.0, a.1), (b.0, b.1))
            segs.append((d, a, b))
            total += d
        }
        let target = total * clamped
        var travelled = 0.0
        for (d, a, b) in segs {
            if travelled + d >= target {
                let t = d == 0 ? 0 : (target - travelled) / d
                return (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
            }
            travelled += d
        }
        let last = geometry[geometry.count - 1]
        return (last[0], last[1])
    }

    static func bearing(at progress: Double, geometry: [[Double]]) -> Double {
        guard geometry.count >= 2 else { return 0 }
        let a = point(at: progress, geometry: geometry)
        let b = point(at: min(1, progress + 0.001), geometry: geometry)
        return Nav.bearing((a.lon, a.lat), (b.lon, b.lat))
    }

    /// Positive metres = right of travel direction.
    static func offsetLateral(
        lon: Double, lat: Double, bearingDeg: Double, meters: Double
    ) -> (lon: Double, lat: Double) {
        let rad = (bearingDeg + 90) * .pi / 180
        let dLat = (meters / 111_320) * cos(rad)
        let cosLat = max(0.2, cos(lat * .pi / 180))
        let dLon = (meters / (111_320 * cosLat)) * sin(rad)
        return (lon + dLon, lat + dLat)
    }

    static func carPosition(
        progress: Double, lateral: Double, geometry: [[Double]]
    ) -> (lon: Double, lat: Double, heading: Double) {
        let base = point(at: progress, geometry: geometry)
        let head = bearing(at: progress, geometry: geometry)
        let offset = offsetLateral(
            lon: base.lon, lat: base.lat, bearingDeg: head,
            meters: max(-1, min(1, lateral)) * laneM
        )
        return (offset.lon, offset.lat, head)
    }
}
