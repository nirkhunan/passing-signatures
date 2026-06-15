import { clusterColor, edgeColor } from '../lib/colorScales.js'

/**
 * Collapsible methodology drawer (PRD R9 + glossary + legend).
 * Explains the overrepresentation method, shows the selected team's five
 * z-scores, names the data source + limitations, and defines key terms.
 *
 * @param {{ team: import('../types.js').TeamNetwork|null, open: boolean, onToggle: ()=>void }} props
 */
export default function Methodology({ team, open, onToggle }) {
  return (
    <footer className="border-t border-border bg-surface">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-6 py-2 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-node"
      >
        <span className="font-mono text-xs text-text-muted">{open ? '▾' : '▸'}</span>
        <span className="font-body text-sm text-text-muted">
          Methodology — what “overrepresented” means, data, limitations
        </span>
      </button>

      {open && (
        <div className="max-h-[42vh] overflow-y-auto border-t border-border px-6 py-4">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Method + data + legend */}
            <section>
              <h3 className="mb-2 font-display text-sm font-semibold">How clusters are found</h3>
              <p className="font-body text-sm leading-relaxed text-text-muted">
                We build each team’s <strong className="text-text">directed passing network</strong>
                {' '}(players = nodes, completed passes = weighted directed edges, normalized
                per&nbsp;90). For every 3-player passing triangle we measure its combined passing
                volume, then compare it to <strong className="text-text">~1,000 randomized networks</strong>
                {' '}that preserve each player’s number of passing links. The{' '}
                <strong className="text-text">z-score</strong> is how many standard deviations above
                random a triangle sits; the <strong className="text-text">top 5</strong> are the
                team’s signature clusters.
              </p>
              <p className="mt-3 font-body text-sm leading-relaxed text-text-muted">
                <strong className="text-text">Data:</strong>{' '}
                {team ? `${team.tournament.source} — ${team.tournament.name}` : 'StatsBomb Open Data'}.
                Players need <strong className="text-text">≥ 90 minutes</strong> to appear; touches are
                ball receptions.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-text-muted">
                <Swatch color={edgeColor('forward')} label="forward →" />
                <Swatch color={edgeColor('lateral')} label="lateral" />
                <Swatch color={edgeColor('backward')} label="backward" />
                <span>arrows show pass direction</span>
              </div>
            </section>

            {/* This team's five clusters with z-scores */}
            <section>
              <h3 className="mb-2 font-display text-sm font-semibold">
                {team ? `${team.team.name} — 5 clusters` : 'Five clusters'}
              </h3>
              {team ? (
                <ul className="space-y-2">
                  {team.clusters.map((c) => {
                    const names = c.player_ids
                      .map((id) => team.nodes.find((n) => n.player_id === id)?.name)
                      .filter(Boolean)
                      .map((n) => n.split(' ').slice(-1)[0])
                      .join(' · ')
                    return (
                      <li key={c.rank} className="flex gap-2">
                        <span
                          className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border-2"
                          style={{ borderColor: clusterColor(c.rank) }}
                        />
                        <div>
                          <p className="font-body text-sm text-text">
                            <span className="font-mono text-text-muted">z={c.z_score}</span>{' '}
                            {c.label}
                          </p>
                          <p className="font-body text-xs text-text-muted">{names}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="font-body text-sm text-text-muted">
                  Select a team to see its five overrepresented clusters and z-scores.
                </p>
              )}
            </section>

            {/* Glossary + limitations */}
            <section>
              <h3 className="mb-2 font-display text-sm font-semibold">Glossary &amp; limitations</h3>
              <dl className="space-y-1.5 font-body text-sm text-text-muted">
                <Term term="Pass link">
                  a directed connection bundling every completed pass between an ordered pair (not the
                  pass count, not per-game).
                </Term>
                <Term term="Cluster">a statistically overrepresented 3-player passing triangle.</Term>
                <Term term="z-score">how unusual something is vs. chance; higher = more distinctive.</Term>
                <Term term="Motif">the network-science term for a small recurring sub-pattern (here, a triangle).</Term>
              </dl>
              <p className="mt-3 font-body text-xs leading-relaxed text-text-muted">
                <strong className="text-text">Limitations:</strong> completed passes only; cameo
                players (&lt; 90′) and incomplete passes are excluded. Per-90 rates can flatter players
                who featured mainly in lopsided matches (small sample). No expected-threat (xT)
                weighting in v1.
              </p>
            </section>
          </div>
        </div>
      )}
    </footer>
  )
}

function Swatch({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function Term({ term, children }) {
  return (
    <div>
      <dt className="inline font-medium text-text">{term} — </dt>
      <dd className="inline">{children}</dd>
    </div>
  )
}
