/**
 * Data loader (PRD §5, §11 Stage 2).
 *
 * The ONLY place tournament data paths live. Paths are tournament-keyed
 * (/data/<tournament>/...) so phase 2 is "add a folder", not a rewrite. The
 * literal "wc2022" appearing here is the data-path config the PRD explicitly
 * allows; components never hardcode a tournament — they receive it as data.
 *
 * Fully client-side: fetches static JSON, caches in memory only (no localStorage
 * / no browser storage, per the locked constraints).
 *
 * @typedef {import('../types.js').TournamentIndex} TournamentIndex
 * @typedef {import('../types.js').TeamNetwork} TeamNetwork
 */

// import.meta.env.BASE_URL is "/" in dev and the configured base on deploy
// (e.g. GitHub Pages subpath), so data URLs stay correct in both.
const DATA_ROOT = `${import.meta.env.BASE_URL}data`

/** Default tournament for v1 (the only one surfaced; phase 2 adds a selector). */
export const DEFAULT_TOURNAMENT = 'wc2022'

/** In-memory caches so re-selecting a team doesn't refetch. */
const _indexCache = new Map()
const _teamCache = new Map()

/**
 * Load a tournament's index (metadata + team list for the dropdown).
 * @param {string} [tournament]
 * @returns {Promise<TournamentIndex>}
 */
export async function loadIndex(tournament = DEFAULT_TOURNAMENT) {
  if (_indexCache.has(tournament)) return _indexCache.get(tournament)
  const url = `${DATA_ROOT}/${tournament}/_index.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load index "${tournament}" (${res.status})`)
  const data = await res.json()
  _indexCache.set(tournament, data)
  return data
}

/**
 * Lazy-load one team's full network.
 * @param {string} tournament
 * @param {string} file - the team's filename from the index (e.g. "spain.json")
 * @returns {Promise<TeamNetwork>}
 */
export async function loadTeam(tournament, file) {
  const key = `${tournament}/${file}`
  if (_teamCache.has(key)) return _teamCache.get(key)
  const url = `${DATA_ROOT}/${tournament}/${file}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load team "${file}" (${res.status})`)
  const data = await res.json()
  _teamCache.set(key, data)
  return data
}
