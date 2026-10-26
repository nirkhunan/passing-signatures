import { useEffect, useMemo, useRef, useState } from 'react'
import { useSize } from '../lib/useTween.js'
import { INK, MUTED, TYPE_COLORS, TYPE_LABELS, textOn, yearOf } from '../lib/theme.js'

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Stacked shares over the three World Cups, drawn like the reference's decade chart:
 * one flat plateau per tournament, slanted joins between them, bands stacked to 100%.
 *
 * shares: { [tournamentId]: { [type]: 0..1 } }    order: bottom -> top
 * focus:  types drawn in full colour, outlined, with big start/end percentages
 * Bands grow in on first show; switching datasets morphs one chart into the other.
 */
export default function StackedArea({ tids, shares, order, focus = [], title, ariaLabel }) {
  const ref = useRef(null)
  const { w, h } = useSize(ref)
  const target = useMemo(() => tids.map((t) => order.map((k) => shares[t]?.[k] ?? 0)), [tids, shares, order])
  const [vals, setVals] = useState(() => tids.map(() => order.map(() => 0)))
  const shown = useRef(vals)
  const raf = useRef(0)

  useEffect(() => {
    const from = shown.current
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { shown.current = target; setVals(target); return }
    const start = performance.now()
    const dur = 1100
    cancelAnimationFrame(raf.current)
    const step = (now) => {
      const k = ease(Math.min(1, (now - start) / dur))
      const next = target.map((row, i) => row.map((v, j) => from[i][j] + (v - from[i][j]) * k))
      shown.current = next
      setVals(next)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target])

  if (!w || !h) return <div ref={ref} className="area" />

  const narrow = w < 560
  const padL = narrow ? 8 : 92
  const padR = narrow ? 8 : 92
  const top = narrow ? 64 : 34
  const bottom = 30
  const W = w - padL - padR
  const H = h - top - bottom
  const n = tids.length
  const seg = W / n
  const join = seg * 0.16
  // x-extent of each tournament's plateau
  const plateau = tids.map((_, i) => [padL + i * seg + (i ? join / 2 : 0), padL + (i + 1) * seg - (i < n - 1 ? join / 2 : 0)])
  const yOf = (share) => top + H * (1 - share)

  // cumulative boundaries per tournament: lower/upper for each band
  const bounds = vals.map((row) => {
    let acc = 0
    return row.map((v) => {
      const lo = acc
      acc += v
      return [lo, acc]
    })
  })
  const bandPath = (j) => {
    const upper = []
    const lower = []
    plateau.forEach(([x0, x1], i) => {
      const [lo, hi] = bounds[i][j]
      upper.push([x0, yOf(hi)], [x1, yOf(hi)])
      lower.push([x0, yOf(lo)], [x1, yOf(lo)])
    })
    const pts = [...upper, ...lower.reverse()]
    return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`
  }
  const anyFocus = focus.length > 0
  const pct = (v) => `${Math.round(v * 100)}%`
  const big = narrow ? 26 : Math.min(54, w / 22)

  return (
    <div ref={ref} className="area">
      <svg width={w} height={h} role="img" aria-label={ariaLabel}>
        {title && <text x={w / 2} y={narrow ? 16 : 18} textAnchor="middle" className="area-title">{title}</text>}

        {order.map((k, j) => {
          const on = !anyFocus || focus.includes(k)
          return (
            <path
              key={k}
              d={bandPath(j)}
              fill={TYPE_COLORS[k]}
              fillOpacity={on ? 1 : 0.28}
              stroke="var(--bg)"
              strokeWidth={2}
              style={{ transition: 'fill-opacity 500ms' }}
            />
          )
        })}

        {/* dashed outline around each focused band, like the reference */}
        {order.map((k, j) => focus.includes(k) && (
          <path key={`o-${k}`} d={bandPath(j)} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="6 4" />
        ))}

        {/* band names on the first plateau when there's room */}
        {order.map((k, j) => {
          const [lo, hi] = bounds[0][j]
          // On phones the focus bands carry percentages in that spot (their names are in the text).
          if ((hi - lo) * H < 22 || (narrow && focus.includes(k))) return null
          return (
            <text key={`n-${k}`} x={plateau[0][0] + 12} y={(yOf(lo) + yOf(hi)) / 2 + 5}
              className={`area-band ${focus.includes(k) ? 'on' : ''}`} fill={focus.includes(k) || !anyFocus ? textOn(TYPE_COLORS[k]) : INK}>{TYPE_LABELS[k]}</text>
          )
        })}

        {/* focused bands: big start/end shares, small middle shares */}
        {order.map((k, j) => {
          if (!focus.includes(k)) return null
          const mid = (i) => (yOf(bounds[i][j][0]) + yOf(bounds[i][j][1])) / 2
          const v = (i) => vals[i][j]
          return (
            <g key={`p-${k}`} className="area-pcts">
              {narrow ? (
                plateau.map(([x0, x1], i) => (
                  <text key={i} x={(x0 + x1) / 2} y={mid(i) + 6} textAnchor="middle" className="area-mid on" fill={textOn(TYPE_COLORS[k])}>{pct(v(i))}</text>
                ))
              ) : (
                <>
                  <text x={padL - 10} y={mid(0) + big * 0.35} textAnchor="end" className="area-big" style={{ fontSize: big }}>{pct(v(0))}</text>
                  {plateau.slice(1, -1).map(([x0, x1], i) => (
                    <text key={i} x={(x0 + x1) / 2} y={mid(i + 1) + 6} textAnchor="middle" className="area-mid" fill={textOn(TYPE_COLORS[k])}>{pct(v(i + 1))}</text>
                  ))}
                  <text x={w - padR + 10} y={mid(n - 1) + big * 0.35} className="area-big" style={{ fontSize: big }}>{pct(v(n - 1))}</text>
                </>
              )}
            </g>
          )
        })}

        {plateau.map(([x0, x1], i) => (
          <text key={tids[i]} x={(x0 + x1) / 2} y={h - 8} textAnchor="middle" className="swarm-year">{yearOf(tids[i])}</text>
        ))}
        <line x1={padL} x2={w - padR} y1={top + H} y2={top + H} stroke={MUTED} />
      </svg>
    </div>
  )
}
