import { useMemo, useRef, useState } from 'react'
import { fitPitch, layoutNodes, markings, edgePath } from '../lib/pitchGeometry.js'
import { useSize, useTweenedPositions } from '../lib/useTween.js'
import { P, clusterColor, DIRECTION_COLORS, INK, MUTED, RULE } from '../lib/theme.js'

const DIM = P.c100

/**
 * A team's passing network on the pitch. Same drawing for every tournament:
 * players on formation slots, curved directed links weighted by passes per 90,
 * the five signature triangles in colour. Pass direction is drawn only when the
 * caller turns it on AND the link has real recorded locations.
 *
 * view: {
 *   clusters: number[]        signature triangles to colour (ranks 1–5)
 *   isolate: number|null      show only this triangle
 *   labels: 'none'|'cluster'|'all'
 *   minPer90: number          hide pairs that exchanged fewer passes per 90 (both ways)
 *   lines: {GK,DF,MF,FW}      which units to show
 *   direction: boolean        colour links by real pass direction (where recorded)
 *   focus: string|null        a person id to spotlight
 * }
 */
export default function Pitch({ doc, view, onNodeClick, onBackground, onIsolate, ariaLabel }) {
  const ref = useRef(null)
  const { w, h } = useSize(ref)
  const [hover, setHover] = useState(null)

  const rect = useMemo(() => (w && h ? fitPitch(w, h) : null), [w, h])
  const target = useMemo(() => (rect && doc ? layoutNodes(doc.nodes, rect) : {}), [rect, doc])
  const pos = useTweenedPositions(target)

  const v = {
    clusters: [],
    isolate: null,
    labels: 'cluster',
    minPer90: 1,
    lines: { GK: true, DF: true, MF: true, FW: true },
    direction: false,
    focus: null,
    ...view,
  }

  const model = useMemo(() => {
    if (!doc) return null
    const byId = Object.fromEntries(doc.nodes.map((n) => [n.id, n]))
    const shown = v.isolate ? [v.isolate] : v.clusters
    const tri = doc.clusters.filter((c) => shown.includes(c.rank))
    const memberRank = {}
    for (const c of [...tri].sort((a, b) => b.rank - a.rank)) for (const id of c.player_ids) memberRank[id] = c.rank
    const isoSet = v.isolate ? new Set(tri[0]?.player_ids ?? []) : null
    const visible = (id) => v.lines[byId[id]?.pos] !== false && (!isoSet || isoSet.has(id))
    const pairRank = (a, b) => {
      let best = null
      for (const c of tri) if (c.player_ids.includes(a) && c.player_ids.includes(b)) best = best == null ? c.rank : Math.min(best, c.rank)
      return best
    }
    // Base view: one line per pair of players (passes both ways), no arrows.
    // Direction view: the directed links, each with its real recorded direction.
    const merged = new Map()
    for (const e of doc.edges) {
      const k = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`
      const m = merged.get(k) ?? { from: e.from < e.to ? e.from : e.to, to: e.from < e.to ? e.to : e.from, per90: 0, count: 0 }
      m.per90 += e.per90
      m.count += e.count
      merged.set(k, m)
    }
    const pairPer90 = (a, b) => merged.get(a < b ? `${a}|${b}` : `${b}|${a}`)?.per90 ?? 0
    const source = v.direction ? doc.edges : [...merged.values()]
    const maxPer90 = Math.max(...source.map((e) => e.per90), 0.01)
    const edges = source
      .filter((e) => pairPer90(e.from, e.to) >= v.minPer90 && visible(e.from) && visible(e.to))
      .map((e) => ({ ...e, rank: pairRank(e.from, e.to), width: 0.6 + 5.4 * Math.sqrt(e.per90 / maxPer90), norm: e.per90 / maxPer90 }))
      .sort((a, b) => (a.rank != null) - (b.rank != null) || a.per90 - b.per90)
    return { byId, tri, memberRank, isoSet, visible, edges }
  }, [doc, v.isolate, v.clusters.join(','), v.minPer90, v.direction, v.lines.GK, v.lines.DF, v.lines.MF, v.lines.FW])

  const m = rect ? markings(rect) : null
  const ready = rect && model && doc.nodes.every((n) => pos[n.id])
  const anyHighlight = (model?.tri.length ?? 0) > 0
  const spotlight = hover || v.focus

  function edgeStyle(e) {
    const touches = spotlight && (e.from === spotlight || e.to === spotlight)
    if (v.direction) {
      if (!e.has_direction) return { stroke: MUTED, opacity: spotlight ? (touches ? 0.5 : 0.05) : 0.22, dash: '2 3' }
      const k = e.pct_forward >= e.pct_lateral && e.pct_forward >= e.pct_backward ? 'forward'
        : e.pct_backward > e.pct_lateral ? 'backward' : 'lateral'
      return { stroke: DIRECTION_COLORS[k], opacity: spotlight ? (touches ? 0.9 : 0.06) : 0.55 }
    }
    if (spotlight) return { stroke: e.rank ? clusterColor(e.rank) : INK, opacity: touches ? 0.85 : 0.04 }
    if (e.rank) return { stroke: clusterColor(e.rank), opacity: 0.92 }
    return { stroke: INK, opacity: anyHighlight ? 0.06 : 0.1 + 0.45 * e.norm }
  }

  const markerColors = [...Object.values(DIRECTION_COLORS), MUTED]

  return (
    <div ref={ref} className="pitch" onClick={(ev) => ev.target === ev.currentTarget && onBackground?.()}>
      {rect && (
        <svg width={w} height={h} role="img" aria-label={ariaLabel} onClick={(ev) => ev.target.tagName === 'svg' && onBackground?.()}>
          <defs>
            {markerColors.map((c) => (
              <marker key={c} id={`arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                <path d="M0,1 L9,5 L0,9 z" fill={c} />
              </marker>
            ))}
          </defs>

          <g className="pitch-lines" stroke={RULE} fill="none" strokeWidth={1.2} onClick={() => onBackground?.()}>
            {m.rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={i === 0 ? 'var(--pitch)' : 'none'} />)}
            <line {...m.halfway} />
            <circle {...m.circle} />
            {m.spots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} fill={RULE} />)}
          </g>

          {ready && (
            <>
              <g className="triangles">
                {model.tri.map((c) => {
                  const pts = c.player_ids.map((id) => pos[id])
                  if (pts.some((p) => !p) || c.player_ids.some((id) => !model.visible(id))) return null
                  return (
                    <path
                      key={c.rank}
                      d={`M${pts.map((p) => `${p.x},${p.y}`).join('L')}Z`}
                      fill={clusterColor(c.rank)}
                      fillOpacity={v.isolate ? 0.14 : 0.1}
                      stroke={clusterColor(c.rank)}
                      strokeOpacity={0.5}
                      strokeDasharray="3 3"
                      onDoubleClick={(ev) => { ev.stopPropagation(); onIsolate?.(c.rank) }}
                      style={{ cursor: onIsolate ? 'zoom-in' : 'default' }}
                    >
                      <title>{`${c.label}: ${c.description}`}</title>
                    </path>
                  )
                })}
              </g>

              <g className="edges" fill="none">
                {model.edges.map((e) => {
                  const a = pos[e.from]
                  const b = pos[e.to]
                  if (!a || !b) return null
                  const s = edgeStyle(e)
                  return (
                    <path
                      key={`${e.from}>${e.to}`}
                      d={v.direction ? edgePath(a, b) : `M${a.x},${a.y}L${b.x},${b.y}`}
                      strokeLinecap="round"
                      stroke={s.stroke}
                      strokeOpacity={s.opacity}
                      strokeWidth={e.width}
                      strokeDasharray={s.dash}
                      markerEnd={v.direction && s.opacity > 0.2 ? `url(#arrow-${s.stroke.slice(1)})` : undefined}
                      style={{ transition: 'stroke-opacity 400ms, stroke 400ms' }}
                    />
                  )
                })}
              </g>

              <g className="nodes">
                {doc.nodes.map((n) => {
                  const p = pos[n.id]
                  const vis = model.visible(n.id)
                  const rank = model.memberRank[n.id]
                  const focused = n.id === v.focus
                  const dimmed = !vis || (spotlight && n.id !== spotlight && !(model.edges.some((e) => (e.from === spotlight && e.to === n.id) || (e.to === spotlight && e.from === n.id))))
                  const fill = !vis ? DIM : rank ? clusterColor(rank) : anyHighlight ? P.c200 : INK
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x},${p.y})`}
                      className="node"
                      style={{ opacity: dimmed && vis ? 0.35 : 1, transition: 'opacity 300ms' }}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={(ev) => { ev.stopPropagation(); onNodeClick?.(n.id) }}
                      tabIndex={onNodeClick ? 0 : -1}
                      onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onNodeClick?.(n.id)}
                      role={onNodeClick ? 'button' : undefined}
                      aria-label={`${n.name}, ${n.receptions_per90} passes received per 90`}
                    >
                      <circle r={p.r + 9} fill="transparent" />
                      {focused && <circle r={p.r + 5} fill="none" stroke={INK} strokeWidth={1.5} />}
                      <circle r={p.r} fill={fill} stroke="var(--bg)" strokeWidth={1.5} />
                    </g>
                  )
                })}
              </g>

              <g className="labels" pointerEvents="none">
                {doc.nodes.map((n) => {
                  const p = pos[n.id]
                  const show = n.id === hover || n.id === v.focus || v.labels === 'all' ||
                    (v.labels === 'cluster' && model.memberRank[n.id] && model.visible(n.id))
                  if (!show || !model.visible(n.id)) return null
                  return (
                    <text key={n.id} x={p.x} y={p.y - p.r - 5} textAnchor="middle" className="node-label">
                      {n.short}
                    </text>
                  )
                })}
              </g>
            </>
          )}
        </svg>
      )}
    </div>
  )
}
