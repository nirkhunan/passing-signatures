import { useMemo } from 'react'
import { SearchBox } from './Select.jsx'
import { codeOf } from '../lib/theme.js'

/** "Highlight a country…" — any nation that played at least one of the three World Cups. */
export default function CountryPicker({ overview, value, onChange, className }) {
  const options = useMemo(() => {
    const m = new Map()
    for (const r of overview.teams) {
      const n = m.get(r.slug) ?? { value: r.slug, label: r.name, years: [] }
      n.years.push(r.tournament.replace(/^wc/, ''))
      m.set(r.slug, n)
    }
    return [...m.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((n) => ({ value: n.value, label: n.label, hint: `${codeOf(n.label)} · ${n.years.join(', ')}` }))
  }, [overview])
  return (
    <SearchBox
      className={`country-picker ${className ?? ''}`}
      placeholder="Highlight a country…"
      options={options}
      value={value}
      onChange={onChange}
      max={60}
    />
  )
}
