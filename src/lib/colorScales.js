/**
 * Visual encoding — the single source for how data maps to pixels (PRD §4, D4/D5).
 * Colors are returned as CSS var() strings so the locked theme tokens in
 * index.css stay the one source of truth.
 */

export const RADIUS_MIN = 6
export const RADIUS_MAX = 26

// ~ the global max touches_per90 across all WC2022 teams. Using a fixed reference
// (not per-team) keeps a player's dot size meaning the same thing across teams,
// so node sizes stay honest through the team-switch morph (Stage 4).
const REF_TOUCHES = 170

/**
 * Node radius ∝ √(touches per 90), clamped to [6, 26]px (D4 — area, not radius,
 * encodes the value, so r = RMAX·√(t/ref)).
 * @param {number} touchesPer90
 */
export function nodeRadius(touchesPer90) {
  const r = RADIUS_MAX * Math.sqrt(Math.max(0, touchesPer90) / REF_TOUCHES)
  return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, r))
}

/** Default player-node color (green-ink). */
export const NODE_COLOR = 'var(--node)'

const EDGE_COLORS = {
  forward: 'var(--edge-forward)', // deep teal — progressive/goalward
  lateral: 'var(--edge-lateral)', // slate — sideways recycling
  backward: 'var(--edge-backward)', // violet — reset/back
}

/**
 * Edge color by dominant direction class (D5).
 * @param {('forward'|'lateral'|'backward')} directionClass
 */
export function edgeColor(directionClass) {
  return EDGE_COLORS[directionClass] ?? EDGE_COLORS.lateral
}

// Reference per-90 volume for a "strong" link; ~ the heaviest pairs (e.g.
// Maguire–Stones ≈ 22). Scales line weight/opacity so strong connections read
// and weak ones recede (R1 readability).
const REF_PER90 = 14

/** Edge stroke width in px, scaled by per-90 volume. */
export function edgeWidth(per90) {
  return Math.max(0.4, Math.min(4, 4 * Math.sqrt(per90 / REF_PER90)))
}

/** Edge opacity, so weak links fade back and the structure stays legible. */
export function edgeOpacity(per90) {
  return Math.max(0.08, Math.min(0.72, 0.1 + 0.62 * Math.sqrt(per90 / REF_PER90)))
}

/** Okabe-Ito cluster hue for a 1-based cluster rank (D8 / R5). */
export function clusterColor(rank) {
  return `var(--cluster-${rank})`
}
