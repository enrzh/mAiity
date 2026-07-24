// Renders the app icon (1024x1024 PNG): deep-blue gradient, folded paper map
// with water/park/roads, red location pin. Run: swift scripts/make_icon.swift <out.png>
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let S: CGFloat = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon.png"

let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: Int(S), height: Int(S), bitsPerComponent: 8,
                    bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

// ---- Background: deep blue -> map blue gradient ---------------------------
let bg = CGGradient(colorsSpace: cs,
                    colors: [rgb(0x1d2c4e), rgb(0x3f6cd6)] as CFArray,
                    locations: [0, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 0, y: S), end: CGPoint(x: 0, y: 0), options: [])

// Subtle "latitude" arcs for depth.
ctx.setStrokeColor(rgb(0xffffff, 0.05))
for i in 1...5 {
    ctx.setLineWidth(3)
    ctx.addArc(center: CGPoint(x: S / 2, y: S + 300), radius: CGFloat(500 + i * 130),
               startAngle: 0, endAngle: .pi * 2, clockwise: false)
    ctx.strokePath()
}

// ---- Folded map -----------------------------------------------------------
// Three panels; middle panel dips to suggest the classic z-fold.
let mL: CGFloat = 152, mR: CGFloat = 872
let foldW = (mR - mL) / 3
let topHi: CGFloat = 700, topLo: CGFloat = 660, botHi: CGFloat = 320, botLo: CGFloat = 280

func mapOutline() -> CGMutablePath {
    let p = CGMutablePath()
    p.move(to: CGPoint(x: mL, y: botLo))
    p.addLine(to: CGPoint(x: mL, y: topLo))
    p.addLine(to: CGPoint(x: mL + foldW, y: topHi))
    p.addLine(to: CGPoint(x: mL + 2 * foldW, y: topLo))
    p.addLine(to: CGPoint(x: mR, y: topHi))
    p.addLine(to: CGPoint(x: mR, y: botHi))
    p.addLine(to: CGPoint(x: mL + 2 * foldW, y: botLo))
    p.addLine(to: CGPoint(x: mL + foldW, y: botHi))
    p.closeSubpath()
    return p
}

// Drop shadow, then paper fill.
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 44, color: rgb(0x000000, 0.35))
ctx.addPath(mapOutline())
ctx.setFillColor(rgb(0xf2ead8))
ctx.fillPath()
ctx.restoreGState()

// Clip everything map-ish to the outline.
ctx.saveGState()
ctx.addPath(mapOutline())
ctx.clip()

// Park blob (green).
ctx.setFillColor(rgb(0xcfe0ae))
ctx.addEllipse(in: CGRect(x: 120, y: 400, width: 340, height: 260))
ctx.fillPath()

// River (blue band across).
ctx.setStrokeColor(rgb(0x9cc3e8))
ctx.setLineWidth(58)
ctx.setLineCap(.round)
ctx.move(to: CGPoint(x: 100, y: 330))
ctx.addCurve(to: CGPoint(x: 930, y: 560),
             control1: CGPoint(x: 420, y: 300), control2: CGPoint(x: 610, y: 620))
ctx.strokePath()

// Roads (white with warm casing).
for (width, color) in [(CGFloat(44), rgb(0xd8cbb0)), (CGFloat(30), rgb(0xfffdf5))] {
    ctx.setStrokeColor(color)
    ctx.setLineWidth(width)
    ctx.move(to: CGPoint(x: 140, y: 610))
    ctx.addCurve(to: CGPoint(x: 900, y: 380),
                 control1: CGPoint(x: 450, y: 660), control2: CGPoint(x: 650, y: 330))
    ctx.strokePath()
    ctx.move(to: CGPoint(x: 380, y: 250))
    ctx.addCurve(to: CGPoint(x: 560, y: 720),
                 control1: CGPoint(x: 470, y: 380), control2: CGPoint(x: 480, y: 570))
    ctx.strokePath()
}

// Fold shading on the two "back" panels.
ctx.setFillColor(rgb(0x000000, 0.08))
ctx.fill(CGRect(x: mL + foldW, y: 0, width: foldW, height: S))
ctx.restoreGState()

// ---- Pin ------------------------------------------------------------------
let pinC = CGPoint(x: S / 2, y: 560)
let r: CGFloat = 128
// Tail.
let tail = CGMutablePath()
tail.move(to: CGPoint(x: pinC.x - 74, y: pinC.y - 36))
tail.addLine(to: CGPoint(x: pinC.x, y: pinC.y - 232))
tail.addLine(to: CGPoint(x: pinC.x + 74, y: pinC.y - 36))
tail.closeSubpath()
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.35))
ctx.addPath(tail)
ctx.setFillColor(rgb(0xe74c3c))
ctx.fillPath()
// Head.
ctx.addEllipse(in: CGRect(x: pinC.x - r, y: pinC.y - r, width: r * 2, height: r * 2))
ctx.setFillColor(rgb(0xe74c3c))
ctx.fillPath()
ctx.restoreGState()
// Inner dot.
ctx.setFillColor(rgb(0xffffff))
ctx.addEllipse(in: CGRect(x: pinC.x - 52, y: pinC.y - 52, width: 104, height: 104))
ctx.fillPath()

// ---- Write PNG ------------------------------------------------------------
let img = ctx.makeImage()!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL,
                                           UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out)")
