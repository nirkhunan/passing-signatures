/**
 * Pitch geometry. Players sit on their FORMATION SLOT (identical rule for every
 * tournament): slot_x 0 = own goal -> 1 = attacking end of the lineup diagram,
 * slot_y 0 = left touchline -> 1 = right touchline.
 *
 * The pitch is drawn horizontally (attacking left -> right) or vertically
 * (attacking upward), whichever fits its box better.
 */
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force'

const LEN = 105
const WID = 68

export function fitPitch(width, height, pad = 18) {
  // Pick whichever orientation draws the bigger pitch in this box (phones: usually vertical).
  const aw0 = Math.max(0, width - 2 * pad)
  const ah0 = Math.max(0, height - 2 * pad)
  const vertical = Math.min(aw0 / WID, ah0 / LEN) > Math.min(aw0 / LEN, ah0 / WID) * 1.05
  const aspect = vertical ? WID / LEN : LEN / WID
  const aw = Math.max(0, width - 2 * pad)
  const ah = Math.max(0, height - 2 * pad)
  let w, h
  if (aw / ah > aspect) {
    h = ah
    w = h * aspect
  } else {
    w = aw
    h = w / aspect
  }
  return { vertical, x0: (width - w) / 2, y0: (height - h) / 2, w, h, s: (vertical ? h : w) / LEN }
}

/** Pitch coordinates (metres: along 0..105 toward goal, across 0..68 left->right) -> screen. */
export function toScreen(rect, along, across) {
  if (rect.vertical) return [rect.x0 + across * rect.s, rect.y0 + rect.h - along * rect.s]
  return [rect.x0 + along * rect.s, rect.y0 + across * rect.s]
}

/** Slot -> pitch metres. Uses most of the length so the lineup reads end to end. */
export function slotToPitch(slotX, slotY) {
  return [LEN * (0.06 + 0.88 * slotX), WID * (0.08 + 0.84 * slotY)]
}

/** Node radius from receptions per 90 (one global scale, so teams and years compare). */
export function nodeRadius(rect, receptionsPer90) {
  const k = Math.max(0.55, Math.min(1.25, rect.s / 6.5))
  return k * (2.6 + 1.05 * Math.sqrt(Math.max(0, receptionsPer90)))
}

/**
 * Screen positions for a team's nodes: slot target, then a short collision pass
 * so players who shared a slot over the tournament don't sit on top of each other.
 */
export function layoutNodes(nodes, rect) {
  const sim = nodes.map((n) => {
    const [a, c] = slotToPitch(n.slot_x, n.slot_y)
    const [x, y] = toScreen(rect, a, c)
    return { id: n.id, tx: x, ty: y, x, y, r: nodeRadius(rect, n.receptions_per90) }
  })
  forceSimulation(sim)
    .force('x', forceX((d) => d.tx).strength(0.35))
    .force('y', forceY((d) => d.ty).strength(0.35))
    .force('c', forceCollide((d) => d.r + 3).iterations(3))
    .stop()
    .tick(160)
  const out = {}
  for (const d of sim) out[d.id] = { x: d.x, y: d.y, r: d.r }
  return out
}

/** Pitch markings as simple shapes in screen space. */
export function markings(rect) {
  const P = (a, c) => toScreen(rect, a, c)
  const box = (a0, c0, a1, c1) => {
    const [x1, y1] = P(a0, c0)
    const [x2, y2] = P(a1, c1)
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
  }
  const [cx, cy] = P(LEN / 2, WID / 2)
  const [h1x, h1y] = P(LEN / 2, 0)
  const [h2x, h2y] = P(LEN / 2, WID)
  const spots = [P(11, WID / 2), P(LEN - 11, WID / 2), [cx, cy]]
  return {
    rects: [
      box(0, 0, LEN, WID),
      box(0, WID / 2 - 20.16, 16.5, WID / 2 + 20.16),
      box(0, WID / 2 - 9.16, 5.5, WID / 2 + 9.16),
      box(LEN - 16.5, WID / 2 - 20.16, LEN, WID / 2 + 20.16),
      box(LEN - 5.5, WID / 2 - 9.16, LEN, WID / 2 + 9.16),
    ],
    halfway: { x1: h1x, y1: h1y, x2: h2x, y2: h2y },
    circle: { cx, cy, r: 9.15 * rect.s },
    spots,
  }
}

/** Curved, directed edge path from a to b, trimmed to the node rims. */
export function edgePath(a, b, bend = 0.14) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const nx = -dy / d
  const ny = dx / d
  const mx = (a.x + b.x) / 2 + nx * d * bend
  const my = (a.y + b.y) / 2 + ny * d * bend
  const trim = (p, q, r) => {
    const ex = q[0] - p[0]
    const ey = q[1] - p[1]
    const l = Math.hypot(ex, ey) || 1
    return [p[0] + (ex / l) * r, p[1] + (ey / l) * r]
  }
  const s = trim([a.x, a.y], [mx, my], a.r + 1.5)
  const e = trim([b.x, b.y], [mx, my], b.r + 3)
  return `M${s[0]},${s[1]} Q${mx},${my} ${e[0]},${e[1]}`
}
