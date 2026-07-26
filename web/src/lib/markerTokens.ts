/// One source of truth for map-marker and route semantics. MapLibre markers
/// and layers take literal values (no CSS cascade), so every hex that lands
/// on the map canvas must come from here — not be re-typed at each call site.

/** Semantic marker/route colors. */
export const MARKER_COLORS = {
  /** Active route line (+ its darker casing underneath). */
  route: '#3b82f6',
  routeCasing: '#1d4ed8',
  /** Category/POI results (teal). */
  poi: '#0d9488',
  /** Saved places (amber). */
  bookmark: '#f59e0b',
  /** The selected place (red) — always the most prominent pin. */
  selected: '#e74c3c',
  /** The "you are here" dot. */
  user: '#1a73e8',
} as const

/** Marker scales — selected is the biggest so it reads above the rest. */
export const MARKER_SCALES = {
  selected: 1.05,
  bookmark: 0.85,
  poi: 0.75,
} as const

/** Route line widths/opacity (casing sits under the line). */
export const ROUTE_STYLE = {
  lineWidth: 5,
  casingWidth: 9,
  casingOpacity: 0.35,
} as const

/** Outline strength for pins — selected gets the strongest stroke. */
export const MARKER_STROKES = {
  selected: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.55))',
  default: 'drop-shadow(0 0 0.5px rgba(0,0,0,0.35))',
} as const
