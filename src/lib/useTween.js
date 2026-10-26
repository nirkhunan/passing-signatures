import { useEffect, useRef, useState } from 'react'

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Smoothly move a map of { id: {x, y, r} } to a new target map. Players present
 * before and after glide; new players appear in place (the caller fades them in).
 * Returns the current interpolated map.
 */
export function useTweenedPositions(target, duration = 750) {
  const [current, setCurrent] = useState(target)
  const shown = useRef(target)
  const raf = useRef(0)

  useEffect(() => {
    const from = shown.current
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !from || from === target) {
      shown.current = target
      setCurrent(target)
      return
    }
    const start = performance.now()
    cancelAnimationFrame(raf.current)
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const k = ease(t)
      const next = {}
      for (const id in target) {
        const a = from[id]
        const b = target[id]
        next[id] = a
          ? { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, r: a.r + (b.r - a.r) * k }
          : b
      }
      shown.current = next
      setCurrent(next)
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return current
}

/** Track an element's size. */
export function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (Math.round(width) === s.w && Math.round(height) === s.h ? s : { w: Math.round(width), h: Math.round(height) }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
