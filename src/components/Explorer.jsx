import { useEffect, useMemo, useState } from 'react'
import Pitch from './Pitch.jsx'
import Swarm, { METRICS, TriangleSwarm, PlayerSwarm, TYPE_ORDER } from './Swarm.jsx'
import { Select, SearchBox } from './Select.jsx'
import { ConfedKey } from './Story.jsx'
import CountryPicker from './CountryPicker.jsx'
import Methodology from './Methodology.jsx'
import { loadTeam } from '../lib/dataLoader.js'
import { clusterColor, textOn, CONFED_LABELS, DIRECTION_COLORS, POS_COLORS, POS_LABEL, TYPE_COLORS, TYPE_LABELS, yearOf } from '../lib/theme.js'

const VIEWS = [['team', 'One team'], ['all', 'All teams'], ['triangles', 'All triangles'], ['players', 'All players']]

const ALL = [1, 2, 3, 4, 5]

export default function Explorer({ overview, people, extras, onStory }) {
  const tids = overview.tournaments.map((t) => t.id)
  const [t, setT] = useState(tids[tids.length - 1])
  const [slug, setSlug] = useState('spain')
  const [mode, setMode] = useState('team')
  const [metric, setMetric] = useState('passes_per90')
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const [clusters, setClusters] = useState(ALL)
  const [isolate, setIsolate] = useState(null)
  const [labels, setLabels] = useState('cluster')
  const [minPer90, setMinPer90] = useState(1)
  const [lines, setLines] = useState({ GK: true, DF: true, MF: true, FW: true })
  const [direction, setDirection] = useState(false)
  const [focus, setFocus] = useState(null)
  const [triMode, setTriMode] = useState('group')
  const [posFocus, setPosFocus] = useState(null)
  const [country, setCountry] = useState(null)

  const teamsIn = (tid) => overview.teams.filter((r) => r.tournament === tid).sort((a, b) => a.name.localeCompare(b.name))
  const row = overview.teams.find((r) => r.tournament === t && r.slug === slug)
  const directionAvailable = !!doc?.edges.some((e) => e.has_direction)

  useEffect(() => {
    let live = true
    setError(null)
    loadTeam(t, slug)
      .then((d) => live && setDoc(d))
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [t, slug])

  useEffect(() => { if (!directionAvailable) setDirection(false) }, [directionAvailable])

  function switchYear(tid) {
    setIsolate(null)
    if (!teamsIn(tid).some((r) => r.slug === slug)) {
      const fallback = teamsIn(tid)[0]
      setNote(`${row?.name ?? 'That team'} didn’t play in ${yearOf(tid)}, so here’s ${fallback.name}.`)
      setSlug(fallback.slug)
      setFocus(null)
    } else {
      setNote(null)
      if (focus && !people[focus]?.tournaments.some((x) => x.t === tid)) setFocus(null)
    }
    setT(tid)
  }

  function openTeam(tid, s, personId = null) {
    setMode('team'); setT(tid); setSlug(s); setIsolate(null); setFocus(personId); setNote(null)
  }

  // Player search across all three tournaments (names come from people.json).
  const names = useMemo(
    () => Object.entries(people)
      .map(([id, p]) => ({ value: id, label: p.name, hint: `${[...new Set(p.tournaments.map((x) => x.team))].join(', ')} · ${p.tournaments.map((x) => yearOf(x.t)).join(', ')}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [people],
  )
  function pickPerson(id) {
    if (!id) return
    const p = people[id]
    const here = p.tournaments.find((x) => x.t === t) ?? p.tournaments[p.tournaments.length - 1]
    openTeam(here.t, here.slug, id)
  }

  const focusNode = doc?.nodes.find((n) => n.id === focus)
  const person = focus ? people[focus] : null
  const yearCount = teamsIn(t).length
  const rankOf = (m) => [...teamsIn(t)].sort((a, b) => b[m] - a[m]).findIndex((r) => r.slug === slug) + 1

  return (
    <div className="explorer">
      <header className="ex-head">
        <button className="brand" onClick={onStory} title="Back to the story">Passing Signatures</button>
        <div className="tabs" role="tablist" aria-label="World Cup" hidden={mode !== 'team'}>
          {tids.map((tid) => (
            <button key={tid} role="tab" aria-selected={t === tid} className={`tab ${t === tid ? 'on' : ''}`} onClick={() => switchYear(tid)}>
              {yearOf(tid)}
            </button>
          ))}
        </div>
        <div className="tabs small" role="tablist" aria-label="View">
          {VIEWS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} className={`tab ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
      </header>

      {mode === 'triangles' ? (
        <section className="ex-all">
          <div className="ex-all-bar">
            <div className="control">
              <span className="control-label">Arrange</span>
              {[['group', 'By type'], ['value', 'By how distinctive']].map(([k, l]) => (
                <button key={k} className={`toggle ${triMode === k ? 'on' : ''}`} aria-pressed={triMode === k} onClick={() => setTriMode(k)}>{l}</button>
              ))}
            </div>
            <CountryPicker overview={overview} value={country} onChange={setCountry} />
            <ul className="confed-key" aria-label="Colour key">
              {TYPE_ORDER.map((k) => <li key={k}><span className="dot" style={{ background: TYPE_COLORS[k] }} />{TYPE_LABELS[k]}</li>)}
            </ul>
          </div>
          <p className="ex-hint">Every signature triangle — five per team per World Cup. Back-line: keeper and defenders only; build-up: defenders with midfielders; attacking: any triangle with a forward. Click a dot to open that team with the triangle isolated.</p>
          <div className="ex-swarm">
            <TriangleSwarm overview={overview} triangles={extras.triangles} mode={triMode} country={country}
              onPick={(m) => { openTeam(m.t, m.slug); setClusters(ALL); setIsolate(m.rank) }} />
          </div>
        </section>
      ) : mode === 'players' ? (
        <section className="ex-all">
          <div className="ex-all-bar">
            <div className="control">
              <span className="control-label">Highlight</span>
              {['GK', 'DF', 'MF', 'FW'].map((k) => (
                <button key={k} className={`toggle pos-toggle ${posFocus === k ? 'on' : ''}`} style={{ '--chip': POS_COLORS[k] }} aria-pressed={posFocus === k} onClick={() => setPosFocus(posFocus === k ? null : k)}>
                  <i style={{ background: POS_COLORS[k] }} />{POS_LABEL[k]}s
                </button>
              ))}
            </div>
            <CountryPicker overview={overview} value={country} onChange={setCountry} />
          </div>
          <p className="ex-hint">Every player with at least 90 minutes, placed by passes received per 90. Pick a position to see its typical (median) player each year. Click a dot to open that player’s team.</p>
          <div className="ex-swarm">
            <PlayerSwarm overview={overview} players={extras.players} focusPos={posFocus} medians={!!posFocus} country={country}
              onPick={(m) => openTeam(m.t, m.slug, m.id)} />
          </div>
        </section>
      ) : mode === 'all' ? (
        <section className="ex-all">
          <div className="ex-all-bar">
            <Select
              label="Compare by"
              value={metric}
              onChange={setMetric}
              options={Object.entries(METRICS).map(([k, m]) => ({ value: k, label: m.label }))}
            />
            <CountryPicker overview={overview} value={country} onChange={setCountry} />
            <ConfedKey />
          </div>
          <p className="ex-hint">Each dot is a team at one World Cup, labelled with its country code; bigger dots played more matches, ringed dots won it. Pick a country to follow it across all three, or click any dot to open that team.</p>
          <div className="ex-swarm">
            <Swarm overview={overview} metric={metric} country={country} onPick={(tid, s) => openTeam(tid, s)} />
          </div>
        </section>
      ) : (
        <section className="ex-team">
          <div className="ex-pickers">
            <Select
              label="Team"
              value={slug}
              onChange={(v) => { setSlug(v); setIsolate(null); setFocus(null); setNote(null) }}
              options={teamsIn(t).map((r) => ({ value: r.slug, label: r.name, hint: r.stage }))}
            />
            <SearchBox
              className="grow"
              label="Find a player"
              placeholder="e.g. Modrić, Messi, Yamal…"
              options={names}
              value={null}
              onChange={pickPerson}
            />
          </div>
          {note && <p className="note">{note}</p>}

          <div className="ex-main">
            <div className="ex-stage">
              {error && <p className="note">{error}</p>}
              {doc && (
                <Pitch
                  doc={doc}
                  view={{ clusters, isolate, labels, minPer90, lines, direction, focus }}
                  onNodeClick={(id) => setFocus(id === focus ? null : id)}
                  onBackground={() => { setIsolate(null); setFocus(null) }}
                  onIsolate={(r) => setIsolate(r === isolate ? null : r)}
                  ariaLabel={`${doc.team.name} passing network, ${yearOf(t)}`}
                />
              )}
              <div className="controls">
                <div className="control">
                  <span className="control-label">Show</span>
                  {['GK', 'DF', 'MF', 'FW'].map((p) => (
                    <button key={p} className={`toggle ${lines[p] ? 'on' : ''}`} aria-pressed={lines[p]} onClick={() => setLines({ ...lines, [p]: !lines[p] })}>
                      {{ GK: 'Keeper', DF: 'Defence', MF: 'Midfield', FW: 'Attack' }[p]}
                    </button>
                  ))}
                </div>
                <label className="control">
                  <span className="control-label">Pairs with ≥ {minPer90} pass{minPer90 === 1 ? '' : 'es'} per 90</span>
                  <input type="range" min={0} max={10} step={0.5} value={minPer90} onChange={(e) => setMinPer90(Number(e.target.value))} />
                </label>
                <div className="control">
                  <span className="control-label">Names</span>
                  {[['none', 'Off'], ['cluster', 'Triangles'], ['all', 'All']].map(([k, l]) => (
                    <button key={k} className={`toggle ${labels === k ? 'on' : ''}`} aria-pressed={labels === k} onClick={() => setLabels(k)}>{l}</button>
                  ))}
                </div>
                <div className="control">
                  <button
                    className={`toggle ${direction ? 'on' : ''}`}
                    aria-pressed={direction}
                    disabled={!directionAvailable}
                    onClick={() => setDirection(!direction)}
                    title={directionAvailable ? 'Colour links by where the passes actually went' : 'FIFA’s 2026 reports don’t record where passes went'}
                  >
                    Pass direction
                  </button>
                  {!directionAvailable && <span className="control-note">not recorded for {yearOf(t)}</span>}
                  {direction && (
                    <span className="dir-key">
                      {Object.entries(DIRECTION_COLORS).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
                      <span><i className="dashed" />no location data</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <aside className="ex-side">
              {row && (
                <div className="card">
                  <h2 className="team-name">{row.name}</h2>
                  <p className="team-meta">{yearOf(t)} · {row.stage} · {row.matches_played} matches · {CONFED_LABELS[row.confederation]}</p>
                  <dl className="stats">
                    {['passes_per90', 'backline_share', 'signature_share'].map((m) => (
                      <div key={m}>
                        <dt>{METRICS[m].short}</dt>
                        <dd>{METRICS[m].fmt(row[m])} <small>{ordinal(rankOf(m))} of {yearCount}</small></dd>
                      </div>
                    ))}
                    <div>
                      <dt>busiest player</dt>
                      <dd className="hub"><button className="link-button" onClick={() => setFocus(row.hub_id)}>{row.hub_name}</button> <small>{Math.round(row.hub_share * 100)}% of passes</small></dd>
                    </div>
                  </dl>
                </div>
              )}

              {doc && (
                <div className="card">
                  <h3 className="card-title">Signature triangles</h3>
                  <p className="card-help">Click to show or hide · double-click a triangle on the pitch to isolate it.</p>
                  <ol className="tri-list">
                    {doc.clusters.map((c) => {
                      const on = clusters.includes(c.rank)
                      return (
                        <li key={c.rank}>
                          <button
                            className={`tri ${on ? 'on' : ''} ${isolate === c.rank ? 'iso' : ''}`}
                            style={{ '--chip': clusterColor(c.rank), '--chip-text': textOn(clusterColor(c.rank)) }}
                            aria-pressed={on}
                            onClick={() => { setClusters(on ? clusters.filter((r) => r !== c.rank) : [...clusters, c.rank].sort()); if (isolate === c.rank) setIsolate(null) }}
                            onDoubleClick={() => setIsolate(isolate === c.rank ? null : c.rank)}
                          >
                            <span className="tri-rank">{c.rank}</span>
                            <span className="tri-body">
                              <span className="tri-names">{c.description}</span>
                              <span className="tri-label">{c.label} · z = {c.z_score.toFixed(1)}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                  <div className="tri-actions">
                    <button className="link-button" onClick={() => { setClusters(ALL); setIsolate(null) }}>All</button>
                    <button className="link-button" onClick={() => { setClusters([]); setIsolate(null) }}>None</button>
                  </div>
                </div>
              )}

              {focusNode && person && (
                <div className="card">
                  <h3 className="card-title">{focusNode.name}</h3>
                  <p className="team-meta">{POS_LABEL[focusNode.pos]} · {focusNode.minutes}′ in {focusNode.matches} matches</p>
                  <dl className="stats two">
                    <div><dt>received / 90</dt><dd>{focusNode.receptions_per90}</dd></div>
                    <div><dt>passed / 90</dt><dd>{focusNode.passes_per90}</dd></div>
                  </dl>
                  <p className="card-help">At each World Cup (90+ minutes):</p>
                  <ul className="career">
                    {tids.map((tid) => {
                      const x = person.tournaments.find((y) => y.t === tid)
                      return (
                        <li key={tid}>
                          {x ? (
                            <button className={`career-btn ${tid === t ? 'here' : ''}`} onClick={() => openTeam(tid, x.slug, focus)}>
                              <b>{yearOf(tid)}</b> {x.team} · {x.minutes}′
                              {x.clusters.length > 0 && <span className="career-tri">{x.clusters.map((r) => <i key={r} style={{ background: clusterColor(r) }} title={`Triangle ${r}`} />)}</span>}
                            </button>
                          ) : (
                            <span className="career-none"><b>{yearOf(tid)}</b> —</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      <Methodology overview={overview} doc={mode === 'team' ? doc : null} />
    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
