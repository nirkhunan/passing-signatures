import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force'
import { useSize } from '../lib/useTween.js'
import { INK, MUTED, RULE, textOn } from '../lib/theme.js'

/**
 * Animated dot chart shared by every "all teams / all triangles / all players" view.
 *
 * Dots are individual items (one team-tournament, one triangle, one player). They
 * drift in from a loose scatter and settle gradually; when the layout changes
 * (e.g. sorting into piles) they travel from where they are. Positions are driven
 * by a live d3-force simulation and written straight to the DOM each tick, so
 * React only re-renders when colours, highlights or labels change.
 *
 * items:   [{ id, row, value?, group?, r, rCode?, fill, ring?, code?, title }]
 * rows:    [{ id, label }]                    one horizontal band per row
 * axis:    { domain, ticks, fmt, lo, hi }     value mode
 * groups:  [{ id, label }]                    group mode: piles left -> right in each row
 * mode:    'value' | 'group'
 * highlight: Set of ids drawn at full strength (others fade) — or null
 * labels:  [{ id, text, sub?, below? }]       callouts next to dots
 * connect: [[id, id, …]]                      lines joining dots (same team across years)
 * notes:   [{ row, group?, value?, text, emphasis? }]  % above piles, or a marked value
 */
export default function Beeswarm({
  items, rows, axis, groups = [], mode = 'value', highlight = null, labels = [], connect = [],
  notes = [], onPick, ariaLabel,
}) {
  const ref = useRef(null)
  const { w, h } = useSize(ref)
  const nodes = useRef(new Map()) // id -> simulation node; survives re-layouts
  const els = useRef(new Map()) // id -> <g>
  const labelEls = useRef(new Map())
  const lineEls = useRef([])
  const sim = useRef(null)
  const [hover, setHover] = useState(null)
  // The tick handler outlives renders; it reads the latest geometry/lines from refs.
  const live = useRef({})

  // ---- geometry ----
  const geo = useMemo(() => {
    if (!w || !h) return null
    const narrow = w < 560
    const padL = narrow ? 46 : 72
    const padR = narrow ? 14 : 36
    const top = 26
    const bottom = mode === 'value' ? 44 : 14
    const rowH = (h - top - bottom) / rows.length
    const plotW = w - padL - padR
    const rowY = (rowId) => top + rowH * (rows.findIndex((r) => r.id === rowId) + 0.5)
    const xOf = (v) => {
      const [a, b] = axis?.domain ?? [0, 1]
      return padL + ((Math.min(Math.max(v, a), b) - a) / (b - a)) * plotW
    }
    const groupX = (g) => padL + (groups.findIndex((x) => x.id === g) + 0.5) * (plotW / Math.max(1, groups.length))
    // Dot size: the item's own radius, shrunk if a row would be too crowded to read.
    const perRow = {}
    for (const it of items) perRow[it.row] = (perRow[it.row] ?? 0) + 1
    const busiest = Math.max(...Object.values(perRow), 1)
    let fit = Math.sqrt((plotW * rowH * 0.42) / (busiest * Math.PI))
    const colW = plotW / Math.max(1, groups.length)
    if (mode === 'group') {
      // Each pile must fit inside its own column.
      const perPile = {}
      for (const it of items) perPile[`${it.row}|${it.group}`] = (perPile[`${it.row}|${it.group}`] ?? 0) + 1
      const biggest = Math.max(...Object.values(perPile), 1)
      fit = Math.min(fit, Math.sqrt((colW * 0.86 * rowH * 0.72 * 0.8) / (biggest * Math.PI)))
    }
    const showCodes = items.some((i) => i.code) && w >= 840 && rowH >= 110
    const k = Math.max(0.7, Math.min(1.15, w / 900))
    const radius = (it) => Math.max(1.6, Math.min(showCodes && it.rCode ? it.rCode : it.r * k, fit))
    return { padL, padR, top, bottom, rowH, plotW, colW, rowY, xOf, groupX, radius, showCodes, narrow }
  }, [w, h, rows, axis, groups, mode, items])

  live.current = { geo: geo && { ...geo, mode }, connect }

  // ---- simulation ----
  useEffect(() => {
    if (!geo) return
    const prev = nodes.current
    const next = new Map()
    const fresh = prev.size === 0
    for (const it of items) {
      const tx = mode === 'group' ? geo.groupX(it.group) : geo.xOf(it.value)
      const ty = geo.rowY(it.row)
      const old = prev.get(it.id)
      const n = old ?? {
        // New dots start loosely scattered across their row and drift into place.
        x: geo.padL + Math.random() * geo.plotW,
        y: ty + (Math.random() - 0.5) * geo.rowH * 0.9,
      }
      n.id = it.id
      n.tx = tx
      n.ty = ty
      n.r = geo.radius(it)
      next.set(it.id, n)
    }
    nodes.current = next
    const list = [...next.values()]
    sim.current?.stop()
    const s = forceSimulation(list)
      // Weak pull + heavy drag = dots glide in over ~3–4 s rather than snapping.
      .force('x', forceX((d) => d.tx).strength(mode === 'group' ? 0.025 : 0.03))
      .force('y', forceY((d) => d.ty).strength(0.035))
      .force('c', forceCollide((d) => d.r + 0.9).iterations(2))
      .velocityDecay(0.45)
      .alpha(fresh ? 1 : 0.8)
      .alphaDecay(0.012)
      .on('tick', place)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      s.stop()
      s.tick(300)
      place()
    }
    sim.current = s
    return () => s.stop()
  }, [geo, items, mode])

  function place() {
    const { geo: b, connect: lines = [] } = live.current
    for (const [id, n] of nodes.current) {
      // Keep each dot inside its own row band.
      if (b) {
        // Keep each dot inside its row band, its pile's column, and clear of the year labels.
        n.y = Math.max(n.ty - b.rowH / 2 + n.r, Math.min(n.ty + b.rowH / 2 - n.r, n.y))
        const lo = b.mode === 'group' ? n.tx - b.colW / 2 + n.r + 2 : b.padL + n.r
        const hi = b.mode === 'group' ? n.tx + b.colW / 2 - n.r - 2 : b.padL + b.plotW - n.r
        n.x = Math.max(lo, Math.min(hi, n.x))
      }
      const el = els.current.get(id)
      if (el) el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`)
    }
    for (const [id, el] of labelEls.current) {
      const n = nodes.current.get(id)
      if (!n || !el) continue
      const below = el.dataset.below === '1'
      el.setAttribute('transform', `translate(${n.x.toFixed(1)},${(n.y + (below ? n.r + 15 : -n.r - 7)).toFixed(1)})`)
    }
    lineEls.current.forEach((el, i) => {
      const ids = lines[i]
      if (!el || !ids) return
      const pts = ids.map((id) => nodes.current.get(id)).filter(Boolean)
      el.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
    })
  }

  // Re-place labels/lines immediately when they change (without restarting motion).
  useLayoutEffect(place)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const allLabels = [...labels]
  if (hover && !labels.some((l) => l.id === hover)) allLabels.push({ id: hover, text: byId.get(hover)?.title ?? '', hover: true })

  return (
    <div ref={ref} className="swarm">
      {geo && (
        <svg width={w} height={h} role="img" aria-label={ariaLabel}>
          {rows.map((r) => (
            <g key={r.id}>
              <line x1={geo.padL} x2={w - 8} y1={geo.rowY(r.id)} y2={geo.rowY(r.id)} stroke={RULE} strokeDasharray="2 4" />
              <text x={4} y={geo.rowY(r.id) + 6} className="swarm-year">{r.label}</text>
            </g>
          ))}

          {mode === 'value' && axis && (
            <g>
              {axis.ticks.map((v) => (
                <g key={v} transform={`translate(${geo.xOf(v)},${h - geo.bottom + 8})`}>
                  <line y1={-6} y2={0} stroke={MUTED} />
                  <text y={14} textAnchor="middle" className="axis-tick">{axis.fmt(v)}</text>
                </g>
              ))}
              {axis.lo && <text x={geo.padL} y={h - 4} className="axis-end">← {axis.lo}</text>}
              {axis.hi && <text x={w - 8} y={h - 4} textAnchor="end" className="axis-end">{axis.hi} →</text>}
            </g>
          )}

          {mode === 'group' && rows.slice(0, 1).map(() => groups.map((g) => (
            <text key={g.id} x={geo.groupX(g.id)} y={14} textAnchor="middle" className="group-head">{geo.narrow ? g.short ?? g.label : g.label}</text>
          )))}

          {connect.map((ids, i) => (
            <polyline key={ids.join('|')} ref={(el) => { lineEls.current[i] = el }} fill="none" stroke={INK} strokeWidth={1.5} strokeOpacity={0.55} />
          ))}

          <g>
            {items.map((it) => {
              const n = nodes.current.get(it.id)
              const r = n?.r ?? geo.radius(it)
              const on = !highlight || highlight.has(it.id)
              return (
                <g
                  key={it.id}
                  ref={(el) => {
                    if (el) {
                      els.current.set(it.id, el)
                      if (n) el.setAttribute('transform', `translate(${n.x},${n.y})`)
                    } else els.current.delete(it.id)
                  }}
                  style={{ opacity: on ? 1 : 0.22, transition: 'opacity 500ms', cursor: onPick ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHover(it.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onPick?.(it)}
                >
                  <circle
                    r={r}
                    fill={it.fill}
                    stroke={it.ring || (highlight && on && highlight.size < 12) ? INK : 'none'}
                    strokeWidth={it.ring && !(highlight && on) ? 1 : 1.6}
                    strokeDasharray={it.ring && !(highlight && on && highlight.size < 12) ? '2 2' : undefined}
                  />
                  {geo.showCodes && it.code && <text y={3} textAnchor="middle" className="dot-code" fill={textOn(it.fill)}>{it.code}</text>}
                </g>
              )
            })}
          </g>

          {notes.map((nt, i) => {
            const x = nt.group != null ? geo.groupX(nt.group) : geo.xOf(nt.value)
            const y = geo.rowY(nt.row)
            if (nt.group != null) {
              return (
                <text key={i} x={x} y={y - geo.rowH / 2 + 14} textAnchor="middle" className={`pile-pct ${nt.emphasis ? 'on' : ''}`}>{nt.text}</text>
              )
            }
            return (
              <g key={i} transform={`translate(${x},${y})`} pointerEvents="none">
                <line y1={-geo.rowH / 2 + 10} y2={geo.rowH / 2 - 6} stroke={INK} strokeWidth={1.5} strokeDasharray="3 3" />
                <text y={-geo.rowH / 2 + 6} textAnchor="middle" className="median-label">{nt.text}</text>
              </g>
            )
          })}

          <g pointerEvents="none">
            {allLabels.map((l) => (
              <g key={`l-${l.id}`} ref={(el) => (el ? labelEls.current.set(l.id, el) : labelEls.current.delete(l.id))} data-below={l.below ? '1' : '0'}>
                <text textAnchor="middle" className={`swarm-label ${l.hover ? 'hover' : ''}`}>
                  {l.text}
                  {l.sub && <tspan className="swarm-value">{` ${l.sub}`}</tspan>}
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  )
}
