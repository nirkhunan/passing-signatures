import { useEffect, useState } from 'react'
import { loadOverview, loadPeople, loadTriangles, loadPlayers, loadShares } from './lib/dataLoader.js'
import Story from './components/Story.jsx'
import Explorer from './components/Explorer.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

/**
 * Two modes over the same data: a guided story (slides, one changing stage) and
 * a free explorer (year tabs, any team). "#explore" in the URL opens the explorer.
 */
export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(() => (window.location.hash === '#explore' ? 'explore' : 'story'))

  useEffect(() => {
    Promise.all([loadOverview(), loadPeople(), loadTriangles(), loadPlayers(), loadShares()])
      .then(([overview, people, triangles, players, shares]) => setData({ overview, people, extras: { triangles, players, shares } }))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const onHash = () => setMode(window.location.hash === '#explore' ? 'explore' : 'story')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goto = (m) => {
    window.location.hash = m === 'explore' ? 'explore' : ''
    setMode(m)
    window.scrollTo(0, 0)
  }

  if (error) return <div className="error-view"><p className="error-title">Couldn’t load the data.</p><p>{error}</p></div>
  if (!data) return <div className="loading" aria-busy="true">Loading…</div>

  return (
    <ErrorBoundary resetKey={mode}>
      {mode === 'story' ? (
        <Story overview={data.overview} people={data.people} extras={data.extras} onExplore={() => goto('explore')} />
      ) : (
        <Explorer overview={data.overview} people={data.people} extras={data.extras} onStory={() => goto('story')} />
      )}
    </ErrorBoundary>
  )
}
