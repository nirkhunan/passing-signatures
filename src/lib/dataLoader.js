/**
 * Data loader — the ONLY place data paths live.
 *
 * Paths are tournament-keyed (/data/<tournament>/<team>.json). Components never
 * hardcode a tournament; the list of tournaments comes from overview.json.
 * Fully client-side: static JSON, cached in memory only (no browser storage).
 */

// "/" in dev, the GitHub Pages subpath on deploy.
const DATA_ROOT = `${import.meta.env.BASE_URL}data`

const cache = new Map()

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path)
  const p = fetch(`${DATA_ROOT}/${path}`).then((res) => {
    if (!res.ok) throw new Error(`Couldn’t load ${path} (${res.status})`)
    return res.json()
  })
  cache.set(path, p)
  p.catch(() => cache.delete(path))
  return p
}

/** Every team in every tournament, with the cross-year metrics. */
export const loadOverview = () => getJSON('overview.json')

/** Person index: id -> { name, short, tournaments: [{ t, team, slug, minutes, clusters }] }. */
export const loadPeople = () => getJSON('people.json')

/** Every signature triangle and every player (90+ minutes), for the individual-level charts. */
export const loadTriangles = () => getJSON('triangles.json')
export const loadPlayers = () => getJSON('players.json')
/** Share of triangles and of passes in each type, per tournament (stacked-area charts). */
export const loadShares = () => getJSON('shares.json')

/** One team's network in one tournament. */
export const loadTeam = (tournament, slug) => getJSON(`${tournament}/${slug}.json`)
