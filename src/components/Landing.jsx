/**
 * Landing / intro screen (shown before the explorer).
 * Explains what Passing Signatures is and how to read it, then hands off to the
 * visualization via onEnter. On-brand with the "ink on tactical paper" theme.
 *
 * @param {{ onEnter: () => void, teamCount?: number }} props
 */
export default function Landing({ onEnter, teamCount }) {
  return (
    <div className="flex h-full flex-col overflow-auto bg-bg text-text">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-6 py-6">
        <h1 className="font-display-expanded text-4xl font-bold leading-none tracking-tight sm:text-5xl">
          PASSING
          <br />
          SIGNATURES
        </h1>

        <p className="mt-4 max-w-2xl font-body text-lg text-text">
          Every national team passes with an accent. This is a way to <em>see</em> it.
        </p>

        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-text-muted">
          Passing Signatures turns World Cup 2022 event data into an
          explorable map of how each of the {teamCount ?? 32} teams moved the ball —
          who connected with whom, in which direction, and which three-player passing
          triangles they leaned on far more than chance. Switch teams and watch the
          structure reorganize: dense possession webs versus direct, vertical football.
        </p>

        {/* Mini hero motif — a directional passing triangle echoing the theme */}
        <svg viewBox="0 0 320 120" className="my-3 h-14 w-full max-w-xs" aria-hidden="true">
          <line x1="40" y1="90" x2="160" y2="30" stroke="var(--edge-forward)" strokeWidth="3" />
          <line x1="160" y1="30" x2="280" y2="90" stroke="var(--edge-backward)" strokeWidth="3" />
          <line x1="280" y1="90" x2="40" y2="90" stroke="var(--edge-lateral)" strokeWidth="3" />
          <circle cx="40" cy="90" r="14" fill="var(--node)" stroke="var(--surface)" strokeWidth="2" />
          <circle cx="160" cy="30" r="20" fill="var(--node)" stroke="var(--surface)" strokeWidth="2" />
          <circle cx="280" cy="90" r="11" fill="var(--node)" stroke="var(--surface)" strokeWidth="2" />
        </svg>

        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Feature>Pick any of the {teamCount ?? 32} nations and see its passing network</Feature>
          <Feature>Switch between a tactical Pitch view and an abstract Force view</Feature>
          <Feature>Filter by line, pass direction, and connection strength</Feature>
          <Feature>Surface each team’s overrepresented passing clusters</Feature>
        </div>

        {/* How to read it */}
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-text-muted">
            How to read it
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-body text-sm">
            <Legend color="var(--edge-forward)" label="Forward pass" />
            <Legend color="var(--edge-lateral)" label="Lateral pass" />
            <Legend color="var(--edge-backward)" label="Backward pass" />
            <span className="flex items-center gap-2 text-text-muted">
              <span className="inline-block h-3 w-3 rounded-full bg-node" />
              dot size = touches per 90
            </span>
          </div>
          <p className="mt-3 border-t border-border pt-3 font-body text-sm text-text-muted">
            <span className="font-medium text-text">Clusters</span> are the five 3-player passing
            triangles a team used far more often than random chance — its signature combinations.
            <span className="text-text"> Double-click</span> a triangle on the pitch to isolate it;
            <span className="text-text"> click empty space</span> to exit.
          </p>
        </div>

        <div className="mt-6">
          <button
            onClick={onEnter}
            className="rounded-md bg-node px-6 py-3 font-display text-base font-semibold text-surface
                       transition-transform hover:-translate-y-0.5 focus:outline-none
                       focus:ring-2 focus:ring-node focus:ring-offset-2 focus:ring-offset-bg"
          >
            Enter the explorer →
          </button>
        </div>

        <p className="mt-6 font-body text-xs text-text-muted">
          A personal data-viz project. Data: StatsBomb Open Data (FIFA World Cup 2022).
          “Overrepresented” clusters are measured against a degree-preserving null model —
          details in the methodology drawer inside.
        </p>
      </div>
    </div>
  )
}

function Feature({ children }) {
  return (
    <p className="flex items-start gap-2 font-body text-sm text-text">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-text" />
      {children}
    </p>
  )
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block h-0.5 w-6 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
