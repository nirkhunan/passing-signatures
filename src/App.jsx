import { useEffect, useState } from 'react'
import { loadIndex, loadTeam, DEFAULT_TOURNAMENT } from './lib/dataLoader.js'
import Graph from './components/Graph.jsx'
import Landing from './components/Landing.jsx'
import EmptyPitch from './components/PitchBackdrop.jsx'
import Methodology from './components/Methodology.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { clusterColor } from './lib/colorScales.js'

/**
 * App shell (Stage 2: data loading wired in).
 * Loads the tournament index, lazy-loads a team's network on selection, and
 * shows a one-line summary + logs the parsed object (Stage 2 verification).
 * The graph/morph/etc. arrive in later stages. No tournament is hardcoded in
 * components — it flows from the loaded index (phase-2 seam, PRD §12).
 */
export default function App() {
  const [entered, setEntered] = useState(false)
  const [tournament] = useState(DEFAULT_TOURNAMENT)
  const [index, setIndex] = useState(null)
  const [status, setStatus] = useState('Loading team list…')
  const [team, setTeam] = useState(null)
  const [layout, setLayout] = useState('pitch') // 'pitch' | 'force' (PRD wireframe defaults to Pitch)
  const [lines, setLines] = useState({ defense: true, midfield: true, attack: true })
  const [directions, setDirections] = useState({ forward: true, lateral: true, backward: true })
  const [minPasses, setMinPasses] = useState(1)
  const [showLabels, setShowLabels] = useState(false)
  const [clusterOn, setClusterOn] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true })
  const [isolated, setIsolated] = useState(null) // cluster rank being isolated, or null
  const [methodOpen, setMethodOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load the index once on mount.
  useEffect(() => {
    loadIndex(tournament)
      .then((idx) => {
        setIndex(idx)
        setStatus('Select a team.')
      })
      .catch((err) => setStatus(`Couldn’t load team list: ${err.message}`))
  }, [tournament])

  async function handleSelect(file) {
    if (!file) {
      setTeam(null)
      setStatus('Select a team.')
      return
    }
    setStatus('Loading team…')
    setLoading(true)
    try {
      const data = await loadTeam(tournament, file)
      setTeam(data)
      setIsolated(null) // a fresh team clears any active isolate
      setStatus('')
    } catch (err) {
      setTeam(null)
      setStatus(`Couldn’t load team: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!entered) {
    return <Landing onEnter={() => setEntered(true)} teamCount={index?.tournament?.team_count} />
  }

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <h1 className="font-display-expanded text-lg font-bold tracking-wide">
          <button
            onClick={() => setEntered(false)}
            title="Back to intro"
            className="rounded transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-node"
          >
            PASSING SIGNATURES
          </button>
          <span className="ml-3 font-body text-sm font-medium text-text-muted">
            · {index?.tournament?.name ?? 'FIFA WORLD CUP 2022'}
          </span>
        </h1>
        <span className="font-mono text-xs text-text-muted">
          data: {index?.tournament?.source ?? 'StatsBomb'}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-4">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-text-muted">
            Controls
          </p>
          <label className="mb-1 block font-body text-sm font-medium">
            Team
            {loading && <span className="ml-2 font-mono text-xs text-text-muted">· loading…</span>}
          </label>
          <select
            className="w-full rounded border border-border bg-bg px-2 py-1 font-body text-sm
                       focus:outline-none focus:ring-2 focus:ring-node"
            defaultValue=""
            disabled={!index}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">— choose —</option>
            {index?.teams.map((t) => (
              <option key={t.id} value={t.file}>
                {t.name}
              </option>
            ))}
          </select>

          <p className="mb-1 mt-4 font-body text-sm font-medium">Layout</p>
          <div className="flex gap-1 rounded border border-border bg-bg p-0.5">
            {['force', 'pitch'].map((mode) => (
              <button
                key={mode}
                onClick={() => setLayout(mode)}
                className={`flex-1 rounded px-2 py-1 font-body text-sm capitalize transition-colors
                  focus:outline-none focus:ring-2 focus:ring-node ${
                    layout === mode
                      ? 'bg-node text-surface'
                      : 'text-text-muted hover:text-text'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {team && (
            <>
              <div className="relative mb-1 mt-4 flex items-center gap-1.5">
                <p className="font-body text-sm font-medium">Clusters</p>
                <span
                  tabIndex={0}
                  aria-label="What are clusters?"
                  className="peer flex h-3.5 w-3.5 cursor-help items-center justify-center
                             rounded-full border border-text-muted text-[9px] font-bold leading-none text-text-muted"
                >
                  i
                </span>
                <div
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-52 rounded border
                             border-border bg-surface p-2 text-xs font-normal leading-snug text-text opacity-0
                             shadow-sm transition-opacity peer-hover:opacity-100 peer-focus:opacity-100"
                >
                  A <span className="font-medium">cluster</span> is a 3-player passing triangle this team
                  used far more than random chance predicts — one of its 5 most overrepresented
                  combinations (ranked by z-score). Double-click a triangle to isolate it; click empty
                  space to exit.
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {team.clusters.map((c) => {
                  const on = clusterOn[c.rank]
                  return (
                    <button
                      key={c.rank}
                      title={`#${c.rank} ${c.label} · z=${c.z_score} — double-click a triangle on the pitch to isolate`}
                      onClick={() => setClusterOn((p) => ({ ...p, [c.rank]: !p[c.rank] }))}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-surface font-mono
                                 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-node"
                      style={{
                        color: on ? clusterColor(c.rank) : 'var(--text-muted)',
                        border: `2px solid ${on ? clusterColor(c.rank) : 'var(--border)'}`,
                        opacity: on ? 1 : 0.6,
                      }}
                    >
                      {c.rank}
                    </button>
                  )
                })}
              </div>
              {isolated != null && (
                <button
                  onClick={() => setIsolated(null)}
                  className="mt-2 w-full rounded border border-border px-2 py-1 font-body text-xs
                             text-text-muted hover:text-text focus:outline-none focus:ring-2 focus:ring-node"
                >
                  Isolating #{isolated} — exit
                </button>
              )}
            </>
          )}

          <p className="mb-1 mt-4 font-body text-sm font-medium">Connections</p>
          <div className="flex flex-col gap-1">
            {['defense', 'midfield', 'attack'].map((line) => (
              <button
                key={line}
                onClick={() => setLines((prev) => ({ ...prev, [line]: !prev[line] }))}
                className={`flex items-center justify-between rounded border px-2 py-1
                  font-body text-sm capitalize transition-colors
                  focus:outline-none focus:ring-2 focus:ring-node ${
                    lines[line]
                      ? 'border-node bg-node text-surface'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
              >
                {line}
                <span className="font-mono text-xs">{lines[line] ? 'on' : 'off'}</span>
              </button>
            ))}
          </div>

          <p className="mb-1 mt-4 font-body text-sm font-medium">Pass direction</p>
          <div className="flex flex-col gap-1">
            {[
              ['forward', 'var(--edge-forward)'],
              ['lateral', 'var(--edge-lateral)'],
              ['backward', 'var(--edge-backward)'],
            ].map(([dir, color]) => (
              <button
                key={dir}
                onClick={() => setDirections((p) => ({ ...p, [dir]: !p[dir] }))}
                className={`flex items-center justify-between rounded border px-2 py-1
                  font-body text-sm capitalize transition-colors
                  focus:outline-none focus:ring-2 focus:ring-node ${
                    directions[dir]
                      ? 'border-node text-text'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color, opacity: directions[dir] ? 1 : 0.3 }} />
                  {dir}
                </span>
                <span className="font-mono text-xs">{directions[dir] ? 'on' : 'off'}</span>
              </button>
            ))}
          </div>

          <p className="mb-1 mt-4 font-body text-sm font-medium">
            Minimum passes
            <span className="ml-2 font-mono text-xs text-text-muted">≥ {minPasses}</span>
          </p>
          <input
            type="range"
            min={1}
            max={40}
            value={minPasses}
            onChange={(e) => setMinPasses(Number(e.target.value))}
            className="w-full accent-node"
          />

          <button
            onClick={() => setShowLabels((s) => !s)}
            className={`mt-4 flex w-full items-center justify-between rounded border px-2 py-1
              font-body text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-node ${
                showLabels ? 'border-node bg-node text-surface' : 'border-border text-text-muted hover:text-text'
              }`}
          >
            Player labels
            <span className="font-mono text-xs">{showLabels ? 'on' : 'off'}</span>
          </button>
        </aside>

        <main className="relative min-w-0 flex-1">
          {team ? (
            <ErrorBoundary resetKey={team.team.id}>
              <Graph
                team={team}
                layout={layout}
                lines={lines}
                directions={directions}
                minPasses={minPasses}
                showLabels={showLabels}
                clusters={team.clusters}
                clusterOn={clusterOn}
                isolated={isolated}
                onIsolate={setIsolated}
                onClearIsolate={() => setIsolated(null)}
              />
            </ErrorBoundary>
          ) : (
            <EmptyPitch>
              <p className="font-body text-sm text-text-muted">{status}</p>
            </EmptyPitch>
          )}
        </main>
      </div>

      <Methodology team={team} open={methodOpen} onToggle={() => setMethodOpen((o) => !o)} />
    </div>
  )
}
