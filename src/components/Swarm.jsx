import { useMemo } from 'react'
import Beeswarm from './Beeswarm.jsx'
import { CONFED_COLORS, POS_COLORS, POS_LABEL, SOFT, TYPE_COLORS, TYPE_LABELS, codeOf, yearOf } from '../lib/theme.js'

export const METRICS = {
  passes_per90: {
    label: 'Completed passes per 90',
    short: 'passes / 90',
    fmt: (v) => Math.round(v).toString(),
    domain: [100, 800],
    ticks: [200, 400, 600, 800],
    lo: 'Direct',
    hi: 'Possession',
  },
  backline_share: {
    label: 'Share of passes between defenders (incl. goalkeeper)',
    short: 'back-line share',
    fmt: (v) => `${Math.round(v * 100)}%`,
    domain: [0.05, 0.6],
    ticks: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    lo: 'Builds through midfield',
    hi: 'Circulates at the back',
  },
  hub_share: {
    label: 'Share of passes involving the busiest player',
    short: 'hub share',
    fmt: (v) => `${Math.round(v * 100)}%`,
    domain: [0.15, 0.4],
    ticks: [0.2, 0.25, 0.3, 0.35, 0.4],
    lo: 'Shared out',
    hi: 'Runs through one player',
  },
  signature_share: {
    label: 'Share of passes inside the five signature triangles',
    short: 'signature share',
    fmt: (v) => `${Math.round(v * 100)}%`,
    domain: [0.15, 0.55],
    ticks: [0.2, 0.3, 0.4, 0.5],
    lo: 'Spread across the team',
    hi: 'Leans on its triangles',
  },
}

const rowsOf = (overview) => overview.tournaments.map((t) => ({ id: t.id, label: yearOf(t.id) }))

/**
 * Every team at every World Cup — one dot each, coloured by region, labelled with
 * its country code when there's room. highlight: [{ t, slug, label?, below? }],
 * connect: [slug], country: slug (lights up one nation across all three years).
 */
export default function Swarm({ overview, metric = 'passes_per90', highlight = [], connect = [], country = null, onPick }) {
  const M = METRICS[metric]
  const rows = useMemo(() => rowsOf(overview), [overview])
  const items = useMemo(() => overview.teams.map((r) => ({
    id: `${r.tournament}:${r.slug}`,
    row: r.tournament,
    value: r[metric],
    r: 3.4 + 0.75 * r.matches_played,
    rCode: 9.5 + 0.45 * r.matches_played,
    fill: CONFED_COLORS[r.confederation],
    ring: r.stage === 'Champion',
    code: codeOf(r.name),
    title: `${r.name} ${yearOf(r.tournament)} · ${M.fmt(r[metric])}`,
    meta: r,
  })), [overview, metric])

  const countryRows = country ? overview.teams.filter((r) => r.slug === country) : []
  const hl = [...highlight, ...countryRows.map((r) => ({ t: r.tournament, slug: r.slug }))]
    .filter((d, i, all) => all.findIndex((x) => x.t === d.t && x.slug === d.slug) === i)
  const joined = [...new Set(country ? [...connect, country] : connect)]
  const tids = rows.map((r) => r.id)
  const lines = joined.map((slug) => tids.map((t) => `${t}:${slug}`).filter((id) => items.some((i) => i.id === id)))
  const ids = new Set([...hl.map((d) => `${d.t}:${d.slug}`), ...lines.flat()])
  const labels = hl.map((d) => {
    const it = items.find((i) => i.id === `${d.t}:${d.slug}`)
    return it && { id: it.id, text: d.label ?? it.meta.name, sub: M.fmt(it.value), below: d.below }
  }).filter(Boolean)

  return (
    <Beeswarm
      items={items}
      rows={rows}
      axis={M}
      highlight={ids.size ? ids : null}
      labels={labels}
      connect={lines.filter((l) => l.length > 1)}
      onPick={onPick && ((it) => onPick(it.meta.tournament, it.meta.slug))}
      ariaLabel={`Every team at the last three World Cups by ${M.label}`}
    />
  )
}

export const TYPE_ORDER = ['back-line', 'build-up', 'midfield', 'attacking']
const Z_AXIS = { domain: [3, 11.5], ticks: [4, 6, 8, 10], fmt: (v) => `z ${v}`, lo: 'Above chance', hi: 'Far above chance' }

/**
 * Every signature triangle (5 per team per World Cup). mode 'value': placed by
 * z-score; mode 'group': sorted into piles by where the triangle lives, with the
 * share of each pile per year. colour: false = all grey (before the key is shown).
 */
export function TriangleSwarm({ overview, triangles, mode = 'value', colour = true, focusType = null, country = null, onPick }) {
  const rows = useMemo(() => rowsOf(overview), [overview])
  const groups = useMemo(() => TYPE_ORDER.map((id) => ({ id, label: TYPE_LABELS[id], short: { 'back-line': 'Back', 'build-up': 'Build', midfield: 'Mid', attacking: 'Attack' }[id] })), [])
  const items = useMemo(() => triangles.map((t) => ({
    id: `${t.t}:${t.slug}:${t.rank}`,
    row: t.t,
    value: t.z,
    group: t.type,
    r: 4.2,
    fill: colour ? TYPE_COLORS[t.type] : SOFT,
    title: `${t.team} ${yearOf(t.t)}: ${t.names}`,
    meta: t,
  })), [triangles, colour])
  const notes = mode === 'group'
    ? rows.flatMap((r) => {
      const inRow = triangles.filter((t) => t.t === r.id)
      return TYPE_ORDER.map((g) => ({
        row: r.id, group: g, emphasis: g === focusType,
        text: `${Math.round((100 * inRow.filter((t) => t.type === g).length) / inRow.length)}%`,
      }))
    })
    : []
  const hl = focusType || country
    ? new Set(items.filter((i) => (!focusType || i.meta.type === focusType) && (!country || i.meta.slug === country)).map((i) => i.id))
    : null
  return (
    <Beeswarm
      items={items}
      rows={rows}
      axis={Z_AXIS}
      groups={groups}
      mode={mode}
      highlight={hl}
      notes={notes}
      onPick={onPick && ((it) => onPick(it.meta))}
      ariaLabel="Every signature triangle at the last three World Cups"
    />
  )
}

const REC_AXIS = { domain: [0, 100], ticks: [0, 25, 50, 75, 100], fmt: (v) => `${v}`, lo: 'Fewer passes received', hi: 'More passes received' }

/** Every player with 90+ minutes, by passes received per 90, coloured by position. */
export function PlayerSwarm({ overview, players, focusPos = null, medians = false, country = null, onPick }) {
  const rows = useMemo(() => rowsOf(overview), [overview])
  const items = useMemo(() => players.map((p) => ({
    id: `${p.t}:${p.id}`,
    row: p.t,
    value: p.rec90,
    r: 2.6,
    fill: POS_COLORS[p.pos],
    title: `${p.name} (${p.team} ${yearOf(p.t)}) · ${p.rec90} received / 90`,
    meta: p,
  })), [players])
  const hl = focusPos || country
    ? new Set(items.filter((i) => (!focusPos || i.meta.pos === focusPos) && (!country || i.meta.slug === country)).map((i) => i.id))
    : null
  const notes = medians && focusPos
    ? rows.map((r) => {
      const v = players.filter((p) => p.t === r.id && p.pos === focusPos).map((p) => p.rec90).sort((a, b) => a - b)
      const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
      return { row: r.id, value: med, text: `typical ${POS_LABEL[focusPos].toLowerCase()}: ${Math.round(med)}` }
    })
    : []
  return (
    <Beeswarm
      items={items}
      rows={rows}
      axis={REC_AXIS}
      highlight={hl}
      notes={notes}
      onPick={onPick && ((it) => onPick(it.meta))}
      ariaLabel="Every player with at least 90 minutes at the last three World Cups"
    />
  )
}

/** Median helper shared with the story copy. */
export function median(values) {
  const v = [...values].sort((a, b) => a - b)
  if (!v.length) return 0
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
}
