import { useEffect, useRef, useState } from 'react'
import { computePitchRect, pitchMarkings } from '../lib/pitchLayout.js'

/**
 * Faint pitch markings for a given fitted rect (PRD §4 "faint pitch").
 * Shared by the live Graph and the empty-state backdrop so they always match.
 * @param {{ rect: {x0:number,y0:number,w:number,h:number,s:number} }} props
 */
export function PitchMarkings({ rect }) {
  if (!rect || !rect.w) return null
  const m = pitchMarkings(rect)
  return (
    <g stroke="var(--border)" fill="none" strokeWidth={1.25} opacity={0.7}>
      {m.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
      ))}
      <line {...m.halfway} />
      {m.circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={i > 0 ? 'var(--border)' : 'none'} />
      ))}
    </g>
  )
}

/**
 * Self-measuring empty pitch for the "no team selected" state. Renders the pitch
 * outline and overlays any children (e.g. the "Select a team." prompt) on top.
 */
export default function EmptyPitch({ children }) {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rect = size.w ? computePitchRect(size.w, size.h) : null

  return (
    <div ref={ref} className="absolute inset-0">
      <svg width={size.w} height={size.h} className="block">
        <PitchMarkings rect={rect} />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          {children}
        </div>
      )}
    </div>
  )
}
