import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Our own dropdown + search box, drawn in the project's visual language instead
 * of the operating system's native controls. Both are keyboard-accessible
 * (arrows, Enter, Escape, type to filter) and close on outside click.
 */

function useOutside(ref, onOut) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && onOut()
    document.addEventListener('pointerdown', fn)
    return () => document.removeEventListener('pointerdown', fn)
  }, [ref, onOut])
}

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Dropdown. options: [{ value, label, hint? }]. Lists longer than 10 get a filter box. */
export function Select({ label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const list = useRef(null)
  const id = useId()
  useOutside(box, () => setOpen(false))
  const shown = useMemo(() => options.filter((o) => !q || norm(o.label).includes(norm(q))), [options, q])
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    }
  }, [open])
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function pick(o) {
    onChange(o.value)
    setOpen(false)
  }
  function onKey(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); return }
    if (!open) return
    if (e.key === 'Escape') { setOpen(false); e.stopPropagation() }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active]) }
  }

  return (
    <div className={`ps-field ${className}`} ref={box} onKeyDown={onKey}>
      {label && <span className="ps-label" id={`${id}-l`}>{label}</span>}
      <button
        type="button"
        className={`ps-select ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-l ${id}-v` : undefined}
        onClick={() => setOpen(!open)}
      >
        <span id={`${id}-v`} className="ps-value">{current?.label ?? '—'}</span>
        <span className="ps-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="ps-panel">
          {options.length > 10 && (
            <input
              autoFocus
              className="ps-filter"
              placeholder="Type to filter…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0) }}
              aria-label={`Filter ${label ?? 'options'}`}
            />
          )}
          <ul className="ps-list" role="listbox" ref={list} aria-label={label}>
            {shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                data-active={i === active}
                className={`ps-option ${i === active ? 'active' : ''} ${o.value === value ? 'selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span>{o.label}</span>
                {o.hint && <small>{o.hint}</small>}
              </li>
            ))}
            {!shown.length && <li className="ps-empty">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Search box with suggestions (like the reference's "Highlight artists…" bars).
 * options: [{ value, label, hint? }]; value shows as a removable chip.
 */
export function SearchBox({ label, placeholder, options, value, onChange, max = 30, className = '' }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const id = useId()
  useOutside(box, () => setOpen(false))
  const current = options.find((o) => o.value === value)
  const shown = useMemo(() => {
    const n = norm(q.trim())
    if (!n) return options.slice(0, max)
    const starts = options.filter((o) => norm(o.label).startsWith(n))
    const has = options.filter((o) => !norm(o.label).startsWith(n) && norm(`${o.label} ${o.hint ?? ''}`).includes(n))
    return [...starts, ...has].slice(0, max)
  }, [options, q, max])

  function pick(o) {
    onChange(o.value)
    setQ('')
    setOpen(false)
  }
  function onKey(e) {
    if (e.key === 'Escape') { setOpen(false); e.stopPropagation() }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(shown.length - 1, a + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]) }
    if (e.key === 'Backspace' && !q && value) onChange(null)
  }

  return (
    <div className={`ps-field ${className}`} ref={box}>
      {label && <label className="ps-label" htmlFor={id}>{label}</label>}
      <div className={`ps-search ${open ? 'open' : ''}`}>
        <span className="ps-glass" aria-hidden="true" />
        {current && (
          <span className="ps-chip">
            {current.label}
            <button type="button" aria-label={`Clear ${current.label}`} onClick={() => onChange(null)}>×</button>
          </span>
        )}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          value={q}
          placeholder={current ? '' : placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
      </div>
      {open && (
        <ul className="ps-panel ps-list" role="listbox" id={`${id}-list`}>
          {shown.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`ps-option ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
            >
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </li>
          ))}
          {!shown.length && <li className="ps-empty">No matches</li>}
        </ul>
      )}
    </div>
  )
}
