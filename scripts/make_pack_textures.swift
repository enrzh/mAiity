// Generates REAL texture atlases for the themed packs — not recolors.
// Each texture is a seamless power-of-two tile (MapLibre requirement for
// fill-pattern) drawn procedurally, so packs ship pixel-art/asphalt surfaces
// instead of flat fills.
//
//   swift scripts/make_pack_textures.swift minecraft packs/minecraft
//   swift scripts/make_pack_textures.swift gta       packs/gta
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let theme = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "minecraft"
let outDir = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "packs/\(theme)"

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

/// Deterministic PRNG — textures must be identical across rebuilds.
struct Rand {
    var s: UInt64
    init(_ seed: UInt64) { s = (seed &* 0x9E3779B97F4A7C15) | 1 }
    mutating func next() -> CGFloat {
        s ^= s << 13; s ^= s >> 7; s ^= s << 17
        return CGFloat(s % 10_000) / 10_000
    }
}

/// One 64x64 (base px) tile in the atlas, drawn at `scale`.
typealias TileDraw = (CGContext, CGRect, CGFloat, inout Rand) -> Void

// ---- Minecraft: 16x16-style blocks scaled up to a chunky pixel grid --------

/// Pixel-quantized noise fill — the classic Minecraft block face.
func blockFace(_ palette: [UInt32], px: Int = 16) -> TileDraw {
    return { ctx, rect, scale, rnd in
        let cell = rect.width / CGFloat(px)
        for y in 0..<px {
            for x in 0..<px {
                let c = palette[Int(rnd.next() * CGFloat(palette.count)) % palette.count]
                ctx.setFillColor(rgb(c))
                ctx.fill(CGRect(x: rect.minX + CGFloat(x) * cell,
                                y: rect.minY + CGFloat(y) * cell,
                                width: cell + 0.5, height: cell + 0.5))
            }
        }
    }
}

/// Cobblestone: irregular light/dark stone blobs on grey mortar.
let cobble: TileDraw = { ctx, rect, scale, rnd in
    ctx.setFillColor(rgb(0x6b6b6b)); ctx.fill(rect)
    let cell = rect.width / 8
    for y in 0..<8 {
        for x in 0..<8 {
            let shade: UInt32 = [0x8a8a8a, 0x9b9b9b, 0x7a7a7a, 0xa5a5a5][Int(rnd.next() * 4) % 4]
            ctx.setFillColor(rgb(shade))
            let inset = cell * 0.12
            ctx.fill(CGRect(x: rect.minX + CGFloat(x) * cell + inset,
                            y: rect.minY + CGFloat(y) * cell + inset,
                            width: cell - inset * 2, height: cell - inset * 2))
        }
    }
}

/// Wooden planks: horizontal boards with darker seams + grain.
let planks: TileDraw = { ctx, rect, scale, rnd in
    ctx.setFillColor(rgb(0x9c6b3f)); ctx.fill(rect)
    let boards = 4
    let h = rect.height / CGFloat(boards)
    for i in 0..<boards {
        let y = rect.minY + CGFloat(i) * h
        ctx.setFillColor(rgb([0xa87342, 0x966337, 0xb07c4a, 0x8d5c33][i % 4]))
        ctx.fill(CGRect(x: rect.minX, y: y, width: rect.width, height: h - scale))
        ctx.setFillColor(rgb(0x6b4626))
        ctx.fill(CGRect(x: rect.minX, y: y + h - scale, width: rect.width, height: scale))
        // grain
        ctx.setFillColor(rgb(0x7d5330, 0.5))
        for _ in 0..<3 {
            let gx = rect.minX + rnd.next() * rect.width
            ctx.fill(CGRect(x: gx, y: y + 2 * scale, width: scale * (1 + rnd.next() * 3), height: h - 4 * scale))
        }
    }
}

// ---- GTA: asphalt, neon grid ----------------------------------------------

/// Asphalt: dark speckled tarmac.
let asphalt: TileDraw = { ctx, rect, scale, rnd in
    ctx.setFillColor(rgb(0x23262b)); ctx.fill(rect)
    for _ in 0..<650 {
        let x = rect.minX + rnd.next() * rect.width
        let y = rect.minY + rnd.next() * rect.height
        let r = (0.4 + rnd.next()) * scale
        let light = rnd.next() < 0.5
        ctx.setFillColor(light ? rgb(0x3a3f47, 0.7) : rgb(0x15171a, 0.7))
        ctx.fillEllipse(in: CGRect(x: x, y: y, width: r, height: r))
    }
}

/// Neon city grid: dark base with glowing magenta/cyan lines.
let neonGrid: TileDraw = { ctx, rect, scale, rnd in
    ctx.setFillColor(rgb(0x0d0a19)); ctx.fill(rect)
    ctx.setLineWidth(1.2 * scale)
    for i in stride(from: 0, through: 64, by: 16) {
        let p = CGFloat(i) * scale
        ctx.setStrokeColor(rgb(0xff2fb9, 0.5))
        ctx.move(to: CGPoint(x: rect.minX + p, y: rect.minY))
        ctx.addLine(to: CGPoint(x: rect.minX + p, y: rect.maxY))
        ctx.strokePath()
        ctx.setStrokeColor(rgb(0x21e5ff, 0.35))
        ctx.move(to: CGPoint(x: rect.minX, y: rect.minY + p))
        ctx.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + p))
        ctx.strokePath()
    }
}

/// Palm-lined sand / beach for the Vice look.
let sand: TileDraw = { ctx, rect, scale, rnd in
    ctx.setFillColor(rgb(0xe8c88a)); ctx.fill(rect)
    for _ in 0..<400 {
        let x = rect.minX + rnd.next() * rect.width
        let y = rect.minY + rnd.next() * rect.height
        ctx.setFillColor(rnd.next() < 0.5 ? rgb(0xd9b673, 0.6) : rgb(0xf3daa6, 0.6))
        ctx.fillEllipse(in: CGRect(x: x, y: y, width: scale, height: scale))
    }
}

// ---- Atlas assembly --------------------------------------------------------

struct Tile { let name: String; let draw: TileDraw }

let tiles: [Tile] = {
    switch theme {
    case "minecraft":
        return [
            Tile(name: "mc-grass", draw: blockFace([0x5d9c3c, 0x6ab04a, 0x4f8c33, 0x74bb52])),
            Tile(name: "mc-water", draw: blockFace([0x3355bb, 0x2f4fae, 0x3e63cf, 0x2a47a0])),
            Tile(name: "mc-stone", draw: cobble),
            Tile(name: "mc-wood",  draw: planks),
            Tile(name: "mc-sand",  draw: blockFace([0xdbcf9a, 0xe5daa8, 0xd0c48d, 0xeae0b5])),
            Tile(name: "mc-dirt",  draw: blockFace([0x8b5a2b, 0x7a4e24, 0x9b6733, 0x6d4520])),
        ]
    default: // gta
        return [
            Tile(name: "gta-asphalt", draw: asphalt),
            Tile(name: "gta-neon",    draw: neonGrid),
            Tile(name: "gta-sand",    draw: sand),
            Tile(name: "gta-water",   draw: blockFace([0x0b2a4a, 0x0d3358, 0x092440, 0x104066])),
        ]
    }
}()

let TILE = 64 // base px per tile (power of two → seamless fill-pattern)

func drawAtlas(scale: Int) -> CGImage {
    let s = CGFloat(scale)
    let W = Int(CGFloat(TILE * tiles.count) * s), H = Int(CGFloat(TILE) * s)
    let cs = CGColorSpace(name: CGColorSpace.sRGB)!
    let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8,
                        bytesPerRow: 0, space: cs,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.interpolationQuality = .none
    for (i, t) in tiles.enumerated() {
        var rnd = Rand(UInt64(i &+ 1) &* 7919)
        let rect = CGRect(x: CGFloat(i * TILE) * s, y: 0, width: CGFloat(TILE) * s, height: CGFloat(TILE) * s)
        ctx.saveGState(); ctx.clip(to: rect)
        t.draw(ctx, rect, s, &rnd)
        ctx.restoreGState()
    }
    return ctx.makeImage()!
}

func writePNG(_ img: CGImage, _ path: String) {
    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL,
                                               UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, img, nil)
    CGImageDestinationFinalize(dest)
}

for scale in [1, 2] {
    let suffix = scale == 1 ? "" : "@2x"
    writePNG(drawAtlas(scale: scale), "\(outDir)/sprite\(suffix).png")
    // Sprite JSON is TOP-left origin; the atlas is a single row so y = 0.
    var entries: [String] = []
    for (i, t) in tiles.enumerated() {
        entries.append("""
          "\(t.name)": { "width": \(TILE * scale), "height": \(TILE * scale), "x": \(i * TILE * scale), "y": 0, "pixelRatio": \(scale) }
        """)
    }
    let json = "{\n" + entries.joined(separator: ",\n") + "\n}\n"
    try! json.write(toFile: "\(outDir)/sprite\(suffix).json", atomically: true, encoding: .utf8)
    print("wrote \(outDir)/sprite\(suffix).{png,json} — \(tiles.count) textures")
}
