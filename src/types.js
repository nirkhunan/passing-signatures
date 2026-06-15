/**
 * JSDoc typedefs mirroring precompute/schema.py (PRD §6).
 * This is the data contract the frontend depends on. If schema.py changes,
 * bump schema_version and update these in lockstep.
 *
 * @typedef {Object} Tournament
 * @property {string} id          - e.g. "wc2022" (tournament key; drives data path)
 * @property {string} name
 * @property {string} source
 * @property {number} team_count
 *
 * @typedef {Object} TeamMeta
 * @property {number} id
 * @property {string} name
 * @property {number} matches_played
 *
 * @typedef {Object} Node
 * @property {number} player_id
 * @property {string} name
 * @property {string} position
 * @property {number} touches_per90
 * @property {number} minutes
 * @property {number} avg_x        - StatsBomb pitch coords, 0–120
 * @property {number} avg_y        - 0–80
 *
 * @typedef {("forward"|"lateral"|"backward")} DirectionClass
 *
 * @typedef {Object} Edge
 * @property {number} from
 * @property {number} to
 * @property {number} count
 * @property {number} per90
 * @property {number} pct_forward
 * @property {number} pct_lateral
 * @property {number} pct_backward
 * @property {DirectionClass} direction_class
 *
 * @typedef {Object} Cluster
 * @property {number} rank
 * @property {number} z_score
 * @property {number[]} player_ids
 * @property {string} label
 * @property {string} description
 *
 * @typedef {Object} TeamNetwork
 * @property {string} schema_version
 * @property {Tournament} tournament
 * @property {TeamMeta} team
 * @property {Node[]} nodes
 * @property {Edge[]} edges
 * @property {Cluster[]} clusters
 *
 * @typedef {Object} IndexTeamEntry
 * @property {number} id
 * @property {string} name
 * @property {string} file
 *
 * @typedef {Object} TournamentIndex
 * @property {string} schema_version
 * @property {Tournament} tournament
 * @property {IndexTeamEntry[]} teams
 */

export {}
