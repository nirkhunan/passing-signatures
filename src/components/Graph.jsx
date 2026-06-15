import { useEffect, useMemo, useRef, useState } from 'react'
import { createSimulation } from '../lib/forceLayout.js'
import { computePitchRect, pitchTarget } from '../lib/pitchLayout.js'
import { PitchMarkings } from './PitchBackdrop.jsx'
import { playerLine } from '../lib/positions.js'
import {
  nodeRadius,
  edgeColor,
  edgeWidth,
  edgeOpacity,
  clusterColor,
  NODE_COLOR,
} from '../lib/colorScales.js'

const MORPH_MS = 700 // eased transition (PRD D14 ~750ms)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/**
 * Passing network with layouts, filters, clusters, and isolate (PRD R1/R5/R6/R7).
 * Takes the team as a prop (no hardcoded tournament — phase-2 seam).
 *
 * @param {{
 *   team: import('../types.js').TeamNetwork, layout: ('force'|'pitch'),
 *   lines: object, directions: object, minPasses: number, showLabels: boolean,
 *   clusters: import('../types.js').Cluster[], clusterOn: object,
 *   isolated: (number|null), onIsolate: (rank:number)=>void, onClearIsolate: ()=>void
 * }} props
 */
export default function Graph({
  team,
  layout,
  lines,
  directions,
  minPasses,
  showLabels,
  clusters,
  clusterOn,
  isolated,
  onIsolate,
  onClearIsolate,
}) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [, setTick] = useState(0)
  const [hoverId, setHoverId] = useState(null)
  const simRef = useRef(null)
  const rafRef = useRef(null)
  const nodesRef = useRef([])
  const linksRef = useRef([])

  // Responsive sizing.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Build node/link copies; seed new dots at the outgoing team's positions for
  // the team-switch morph (Stage 4 / R3).
  useEffect(() => {
    if (!team || size.w === 0 || size.h === 0) return
    const rect = computePitchRect(size.w, size.h)
    const old = nodesRef.current

    const newNodes = team.nodes.map((n) => {
      const p = pitchTarget(n, rect)
      return { ...n, x: p.x, y: p.y }
    })

    if (old && old.length) {
      const byFormation = (a, b) => a.avg_x - b.avg_x || a.avg_y - b.avg_y
      const oldSorted = [...old].sort(byFormation)
      const newSorted = [...newNodes].sort(byFormation)
      newSorted.forEach((n, k) => {
        if (k < oldSorted.length) {
          n.x = oldSorted[k].x
          n.y = oldSorted[k].y
        }
      })
    }

    nodesRef.current = newNodes
    linksRef.current = team.edges.map((e) => ({
      source: e.from,
      target: e.to,
      per90: e.per90,
      count: e.count,
      direction_class: e.direction_class,
    }))
  }, [team, size.w, size.h])

  // Apply the active layout (and morph into it).
  useEffect(() => {
    const nodes = nodesRef.current
    if (!nodes.length || size.w === 0) return

    if (simRef.current) simRef.current.stop()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (layout === 'pitch') {
      const rect = computePitchRect(size.w, size.h)
      const targets = nodes.map((n) => pitchTarget(n, rect))
      const start = nodes.map((n) => ({ x: n.x, y: n.y }))
      const dur = reduce ? 0 : MORPH_MS
      const t0 = performance.now()
      const step = (now) => {
        const e = dur === 0 ? 1 : easeOutCubic(Math.min(1, (now - t0) / dur))
        nodes.forEach((n, i) => {
          n.x = start[i].x + (targets[i].x - start[i].x) * e
          n.y = start[i].y + (targets[i].y - start[i].y) * e
          n.fx = n.x
          n.fy = n.y
        })
        setTick((k) => k + 1)
        if (e < 1) rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    } else {
      nodes.forEach((n) => {
        n.fx = null
        n.fy = null
      })
      const sim = createSimulation(nodes, linksRef.current, size.w, size.h)
      sim.alpha(reduce ? 0.15 : 0.9).restart()
      sim.on('tick', () => setTick((k) => k + 1))
      simRef.current = sim
    }

    return () => {
      if (simRef.current) simRef.current.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [layout, team, size.w, size.h])

  const nodes = nodesRef.current
  const links = linksRef.current
  const byId = useMemo(() => {
    const m = new Map()
    for (const n of nodes) m.set(n.player_id, n)
    return m
  }, [nodes, size.w, size.h])

  const endpoint = (ref) => (typeof ref === 'object' ? ref : byId.get(ref))
  const idOf = (ref) => (typeof ref === 'object' ? ref.player_id : ref)
  const hovered = hoverId != null ? byId.get(hoverId) : null
  const pitchRect = layout === 'pitch' && size.w ? computePitchRect(size.w, size.h) : null

  // Line filter.
  const visible = useMemo(() => {
    const s = new Set()
    for (const n of nodes) if (lines[playerLine(n.position)]) s.add(n.player_id)
    return s
  }, [nodes, lines])

  // Clusters: which to draw + per-node ring memberships. When isolating, only
  // the isolated cluster is drawn; everything else ghosts (R6).
  const allClusters = clusters || []
  const isolatedCluster = isolated != null ? allClusters.find((c) => c.rank === isolated) : null
  const isolatedSet = useMemo(
    () => new Set(isolatedCluster ? isolatedCluster.player_ids : []),
    [isolatedCluster],
  )
  const renderClusters = isolatedCluster
    ? [isolatedCluster]
    : allClusters.filter((c) => clusterOn[c.rank])
  const ringRanks = useMemo(() => {
    const m = new Map()
    for (const c of renderClusters) {
      for (const pid of c.player_ids) {
        if (!m.has(pid)) m.set(pid, [])
        m.get(pid).push(c.rank)
      }
    }
    return m
  }, [renderClusters])

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Isolate transform: center + gently zoom the isolated cluster.
  let isolateStyle
  if (isolatedCluster) {
    const pts = isolatedCluster.player_ids.map((id) => byId.get(id)).filter(Boolean)
    if (pts.length) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
      const scale = 1.3
      const tx = size.w / 2 - scale * cx
      const ty = size.h / 2 - scale * cy
      isolateStyle = {
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        transformOrigin: '0 0',
        transition: reduceMotion ? 'none' : 'transform 600ms ease',
      }
    }
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      style={{
        backgroundColor: isolatedCluster ? 'var(--isolate-veil)' : 'transparent',
        transition: reduceMotion ? 'none' : 'background-color 500ms ease',
      }}
    >
      <svg width={size.w} height={size.h} className="block">
        {/* arrowheads per direction (CVD cue, R8) */}
        <defs>
          {['forward', 'lateral', 'backward'].map((d) => (
            <marker
              key={d}
              id={`arrow-${d}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={edgeColor(d)} />
            </marker>
          ))}
        </defs>

        {/* click empty space to exit isolate */}
        <rect
          x={0}
          y={0}
          width={size.w}
          height={size.h}
          fill="transparent"
          onClick={() => isolatedCluster && onClearIsolate()}
        />

        <g style={isolateStyle}>
          {pitchRect && <PitchMarkings rect={pitchRect} />}

          {/* cluster hulls (translucent triangles); double-click to isolate */}
          <g>
            {renderClusters.map((c) => {
              const pts = c.player_ids.map((id) => byId.get(id)).filter(Boolean)
              if (pts.length < 3) return null
              const points = pts.map((p) => `${p.x},${p.y}`).join(' ')
              return (
                <polygon
                  key={c.rank}
                  points={points}
                  fill={clusterColor(c.rank)}
                  fillOpacity={0.14}
                  stroke={clusterColor(c.rank)}
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  onDoubleClick={() => onIsolate(c.rank)}
                >
                  <title>
                    #{c.rank} {c.label} · z={c.z_score} (double-click to isolate)
                  </title>
                </polygon>
              )
            })}
          </g>

          {/* edges */}
          <g>
            {links.map((l, i) => {
              const a = endpoint(l.source)
              const b = endpoint(l.target)
              if (!a || !b) return null
              if (!visible.has(idOf(l.source)) || !visible.has(idOf(l.target))) return null
              if (!directions[l.direction_class]) return null
              if (l.count < minPasses) return null
              const dim =
                isolatedCluster &&
                (!isolatedSet.has(idOf(l.source)) || !isolatedSet.has(idOf(l.target)))
              // Curved path that stops at each node's edge; a consistent perpendicular
              // bow separates reciprocal passes. Arrowheads (on established links) give
              // a non-color direction cue so flow reads in grayscale (R8 / D6).
              const r1 = nodeRadius(a.touches_per90)
              const r2 = nodeRadius(b.touches_per90)
              const dx = b.x - a.x
              const dy = b.y - a.y
              const len = Math.hypot(dx, dy) || 1
              const ux = dx / len
              const uy = dy / len
              const sx = a.x + ux * r1
              const sy = a.y + uy * r1
              const ex = b.x - ux * (r2 + 4)
              const ey = b.y - uy * (r2 + 4)
              const k = 0.16
              const cx = (sx + ex) / 2 - (ey - sy) * k
              const cy = (sy + ey) / 2 + (ex - sx) * k
              const showArrow = !dim && l.count >= 4
              return (
                <path
                  key={i}
                  d={`M${sx},${sy} Q${cx},${cy} ${ex},${ey}`}
                  fill="none"
                  stroke={edgeColor(l.direction_class)}
                  strokeWidth={edgeWidth(l.per90)}
                  strokeOpacity={edgeOpacity(l.per90) * (dim ? 0.12 : 1)}
                  strokeLinecap="round"
                  markerEnd={showArrow ? `url(#arrow-${l.direction_class})` : undefined}
                />
              )
            })}
          </g>

          {/* nodes + cluster rings */}
          <g>
            {nodes.map((n) => {
              if (!visible.has(n.player_id)) return null
              const r = nodeRadius(n.touches_per90)
              const isHover = n.player_id === hoverId
              const ranks = ringRanks.get(n.player_id) || []
              const dim = isolatedCluster && !isolatedSet.has(n.player_id)
              return (
                <g key={n.player_id} opacity={dim ? 0.1 : 1}>
                  {ranks.map((rank, i) => (
                    <circle
                      key={rank}
                      cx={n.x}
                      cy={n.y}
                      r={r + 3 + i * 3}
                      fill="none"
                      stroke={clusterColor(rank)}
                      strokeWidth={2}
                    />
                  ))}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={NODE_COLOR}
                    stroke="var(--surface)"
                    strokeWidth={isHover ? 3 : 1.5}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverId(n.player_id)}
                    onMouseLeave={() => setHoverId((id) => (id === n.player_id ? null : id))}
                  />
                </g>
              )
            })}
          </g>

          {/* player labels */}
          {showLabels && (
            <g pointerEvents="none">
              {nodes.map((n) =>
                visible.has(n.player_id) ? (
                  <text
                    key={`${n.player_id}-lbl`}
                    x={n.x}
                    y={n.y + nodeRadius(n.touches_per90) + 11}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text-muted)"
                    opacity={isolatedCluster && !isolatedSet.has(n.player_id) ? 0.1 : 1}
                    style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    {n.name.split(' ').slice(-1)[0]}
                  </text>
                ) : null,
              )}
            </g>
          )}

          {hovered && (
            <HoverLabel node={hovered} r={nodeRadius(hovered.touches_per90)} size={size} />
          )}
        </g>
      </svg>
    </div>
  )
}

/** A small white card above the hovered node showing who it is. */
function HoverLabel({ node, r, size }) {
  const text = `${node.name} · ${node.position}`
  const sub = `${node.touches_per90} touches/90`
  const w = Math.max(text.length, sub.length) * 6.7 + 18
  const h = 36
  let x = node.x - w / 2
  let y = node.y - r - h - 8
  x = Math.max(6, Math.min(size.w - w - 6, x))
  if (y < 6) y = node.y + r + 8
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--surface)"
            stroke="var(--border)" strokeWidth={1} />
      <text x={x + 9} y={y + 15} fontSize={12} fontWeight={600} fill="var(--text)"
            style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
        {text}
      </text>
      <text x={x + 9} y={y + 29} fontSize={11} fill="var(--text-muted)"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {sub}
      </text>
    </g>
  )
}
