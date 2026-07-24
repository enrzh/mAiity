// Generates the "paper" pack's sprite atlas: tileable fill-pattern textures.
// MapLibre requires power-of-two pattern sizes for seamless tiling.
// Output: sprite.png/.json + sprite@2x.png/.json into the given directory.
// Run: swift scripts/make_sprites.swift packs/paper
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "packs/paper"

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

/// Deterministic PRNG so the paper grain is stable across builds.
struct Rand {
    var state: UInt64 = 0x9E3779B97F4A7C15
    mutating func next() -> CGFloat {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return CGFloat((state >> 33) % 10_000) / 10_000
    }
}

// Draw one atlas at the given scale. Layout (base px): paper-grain 128x128 at
// (0,0); pencil-hatch 64x64 at (128,0); atlas 256x128 (pot-friendly widths).
func drawAtlas(scale: Int) -> CGImage {
    let s = CGFloat(scale)
    let W = Int(256 * s), H = Int(128 * s)
    let cs = CGColorSpace(name: CGColorSpace.sRGB)!
    let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8,
                        bytesPerRow: 0, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

    // ---- paper-grain (opaque paper base + speckle), tile 128x128 ----------
    let g = CGRect(x: 0, y: 0, width: 128 * s, height: 128 * s)
    ctx.setFillColor(rgb(0xf2ead8))
    ctx.fill(g)
    var rnd = Rand()
    for _ in 0..<900 {
        let x = rnd.next() * g.width
        let y = rnd.next() * g.height
        let r = (0.6 + rnd.next() * 1.2) * s
        let dark = rnd.next() < 0.6
        ctx.setFillColor(dark ? rgb(0x8a7a5a, 0.05 + rnd.next() * 0.06)
                              : rgb(0xffffff, 0.05 + rnd.next() * 0.05))
        ctx.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
    }
    // A few longer fibers.
    ctx.setStrokeColor(rgb(0x8a7a5a, 0.06))
    ctx.setLineWidth(0.8 * s)
    for _ in 0..<24 {
        let x = rnd.next() * g.width, y = rnd.next() * g.height
        ctx.move(to: CGPoint(x: x, y: y))
        ctx.addLine(to: CGPoint(x: x + (rnd.next() - 0.5) * 20 * s, y: y + (rnd.next() - 0.5) * 8 * s))
        ctx.strokePath()
    }

    // ---- pencil-hatch (transparent bg, diagonal strokes), tile 64x64 -------
    let hx = 128 * s
    ctx.saveGState()
    ctx.clip(to: CGRect(x: hx, y: 0, width: 64 * s, height: 64 * s))
    ctx.setStrokeColor(rgb(0x6b5d49, 0.55))
    ctx.setLineCap(.round)
    // 45° lines, spacing 8 base px; draw beyond edges so the tile wraps.
    for i in stride(from: -64, through: 128, by: 8) {
        let jitter = (CGFloat((i * 7) % 5) - 2) * 0.2 * s
        ctx.setLineWidth((1.1 + CGFloat((i % 3)) * 0.25) * s)
        ctx.move(to: CGPoint(x: hx + CGFloat(i) * s + jitter, y: -4 * s))
        ctx.addLine(to: CGPoint(x: hx + CGFloat(i + 68) * s + jitter, y: 68 * s))
        ctx.strokePath()
    }
    ctx.restoreGState()

    return ctx.makeImage()!
}

func writePNG(_ img: CGImage, _ path: String) {
    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL,
                                               UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, img, nil)
    CGImageDestinationFinalize(dest)
}

func indexJSON(scale: Int) -> String {
    let s = scale
    // Sprite JSON is TOP-left origin; CG drew bottom-up. The 64px hatch sits
    // at CG y 0..64 → PNG y (128-64)..128, so its index y is 64*s.
    return """
    {
      "paper-grain": { "width": \(128 * s), "height": \(128 * s), "x": 0, "y": 0, "pixelRatio": \(s) },
      "pencil-hatch": { "width": \(64 * s), "height": \(64 * s), "x": \(128 * s), "y": \(64 * s), "pixelRatio": \(s) }
    }
    """
}

for scale in [1, 2] {
    let suffix = scale == 1 ? "" : "@2x"
    writePNG(drawAtlas(scale: scale), "\(outDir)/sprite\(suffix).png")
    try! indexJSON(scale: scale).write(toFile: "\(outDir)/sprite\(suffix).json", atomically: true, encoding: .utf8)
    print("wrote \(outDir)/sprite\(suffix).{png,json}")
}
