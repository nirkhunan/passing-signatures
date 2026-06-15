/**
 * Pitch layout (PRD R7 / Stage 7).
 * Places players at their average StatsBomb position on a top-view pitch
 * (attack left -> right; x 0–120 -> horizontal, y 0–80 -> vertical, with y=0 the
 * left touchline). A faint pitch is drawn behind the graph for orientation.
 */

/**
 * Fit a 120×80 pitch inside the canvas, preserving aspect ratio, centered.
 * @returns {{x0:number,y0:number,w:number,h:number,s:number}} s = pixels per pitch unit
 */
export function computePitchRect(width, height, pad = 32) {
  const availW = Math.max(0, width - 2 * pad)
  const availH = Math.max(0, height - 2 * pad)
  const aspect = 120 / 80
  let w, h
  if (availW / availH > aspect) {
    h = availH
    w = h * aspect
  } else {
    w = availW
    h = w / aspect
  }
  return { x0: (width - w) / 2, y0: (height - h) / 2, w, h, s: w / 120 }
}

/** Screen position for a node's average pitch coordinates. */
export function pitchTarget(node, rect) {
  return {
    x: rect.x0 + (node.avg_x / 120) * rect.w,
    y: rect.y0 + (node.avg_y / 80) * rect.h,
  }
}

/**
 * Faint pitch markings as plain geometry, in screen coords, for the given rect.
 * Returned as arrays the Graph renders with the --border token at low opacity.
 */
export function pitchMarkings(rect) {
  const { x0, y0, s } = rect
  const U = (x, y) => [x0 + x * s, y0 + y * s] // pitch-units -> screen

  const rects = [
    [0, 0, 120, 80], // outline
    [0, 18, 18, 44], // left penalty box (x 0–18, y 18–62)
    [0, 30, 6, 20], // left six-yard box
    [102, 18, 18, 44], // right penalty box
    [114, 30, 6, 20], // right six-yard box
  ].map(([x, y, w, h]) => {
    const [sx, sy] = U(x, y)
    return { x: sx, y: sy, w: w * s, h: h * s }
  })

  const halfway = (() => {
    const [x1, y1] = U(60, 0)
    const [x2, y2] = U(60, 80)
    return { x1, y1, x2, y2 }
  })()

  const circles = [
    { ...center(U(60, 40)), r: 10 * s }, // center circle
    { ...center(U(60, 40)), r: 1.2 }, // center spot
    { ...center(U(12, 40)), r: 1.2 }, // left penalty spot
    { ...center(U(108, 40)), r: 1.2 }, // right penalty spot
  ]

  return { rects, halfway, circles }
}

function center([cx, cy]) {
  return { cx, cy }
}
